import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma.service';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { DiagnosticarRecepcionCuentaUseCase } from './diagnosticar-recepcion-cuenta.use-case';

function fixture() {
  const prisma = {
    metaCuentaPublicitaria: {
      findFirst: jest.fn().mockResolvedValue({
        metaConexion: {
          id: 'conexion',
          estado: 1,
          tokenCifrado: 'cifrado',
          appId: 'app',
        },
      }),
    },
    metaPagina: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'pagina',
          pageId: 'meta-page',
          nombre: 'Página',
          importarLeadsAutomaticamente: true,
        },
      ]),
    },
    metaFormulario: { findFirst: jest.fn().mockResolvedValue(null) },
    lead: { count: jest.fn().mockResolvedValue(1) },
    whatsappConexion: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const graph = {
    obtenerAccessTokenPagina: jest.fn().mockResolvedValue('page-token'),
    obtenerAppsSuscritas: jest
      .fn()
      .mockResolvedValue([{ id: 'app', camposSuscritos: ['leadgen'] }]),
    listarLeadgenForms: jest
      .fn()
      .mockResolvedValue([{ id: 'form', nombre: 'Formulario' }]),
    contarLeadsDeForm: jest.fn().mockResolvedValue(4),
  };
  const encryption = { decrypt: jest.fn().mockReturnValue('token') };
  return {
    prisma,
    graph,
    caso: new DiagnosticarRecepcionCuentaUseCase(
      prisma as unknown as PrismaService,
      encryption as unknown as TokenEncryptionService,
      graph as unknown as MetaGraphClient,
    ),
  };
}

describe('Diagnóstico de recepción', () => {
  it('consulta el catálogo vivo, detecta formularios no sincronizados y diferencia conteos', async () => {
    const { caso, prisma } = fixture();
    const resultado = await caso.execute('org', 'cuenta');
    expect(resultado.paginas[0]).toMatchObject({
      suscrito: true,
      formularios: [
        { sincronizado: false, leadsMeta: 4, leadsCRM: 1, importacion: null },
      ],
    });
    expect(
      (
        prisma.metaCuentaPublicitaria.findFirst.mock.calls[0] as [
          { where: unknown },
        ]
      )[0].where,
    ).toEqual({ id: 'cuenta', organizacionId: 'org', estado: 1 });
    expect(
      (prisma.metaPagina.findMany.mock.calls[0] as [{ where: unknown }])[0]
        .where,
    ).toEqual({
      organizacionId: 'org',
      metaConexionId: 'conexion',
      estado: 1,
    });
  });

  it('una consulta fallida no se presenta como webhook ausente ni como cero leads', async () => {
    const { caso, graph } = fixture();
    graph.obtenerAppsSuscritas.mockRejectedValue(new Error('permisos'));
    graph.contarLeadsDeForm.mockRejectedValue(new Error('permisos'));
    const resultado = await caso.execute('org', 'cuenta');
    expect(resultado.paginas[0].suscrito).toBeNull();
    expect(resultado.paginas[0].error).toBeTruthy();
    expect(resultado.paginas[0].formularios[0]).toMatchObject({
      leadsMeta: null,
      error: expect.any(String) as unknown,
    });
  });

  it('tener otra app suscrita no confirma nuestra suscripción', async () => {
    const { caso, graph } = fixture();
    graph.obtenerAppsSuscritas.mockResolvedValue([
      { id: 'otra-app', camposSuscritos: ['leadgen'] },
    ]);
    expect((await caso.execute('org', 'cuenta')).paginas[0].suscrito).toBe(
      false,
    );
  });

  it('rechaza cuentas ajenas antes de consultar Meta', async () => {
    const { caso, prisma, graph } = fixture();
    prisma.metaCuentaPublicitaria.findFirst.mockResolvedValue(null);
    await expect(caso.execute('org', 'ajena')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(graph.obtenerAccessTokenPagina).not.toHaveBeenCalled();
  });
});
