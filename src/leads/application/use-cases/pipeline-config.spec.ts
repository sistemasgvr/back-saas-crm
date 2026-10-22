import { ActualizarPipelineConfigUseCase } from '../../../organizations/application/use-cases/actualizar-pipeline-config.use-case';
import type { OrganizacionesRepository } from '../../../organizations/application/ports/organizaciones.repository.port';
import {
  pipelineConfigPorDefecto,
  ESTADOS_TERMINALES,
} from '../../../shared/domain/pipeline-inmobiliaria';
import type {
  LeadsLecturaRepository,
  LeadTableroRow,
} from '../ports/leads-lectura.repository.port';
import { ObtenerMetaPipelineUseCase } from './obtener-meta-pipeline.use-case';
import { ListarTableroLeadsUseCase } from './listar-tablero-leads.use-case';
import { ActualizarGestionLeadUseCase } from './actualizar-gestion-lead.use-case';

describe('Configuración de pipeline en leads y tablero', () => {
  const ctx = { usuarioId: 'usuario', rol: 'ADMINISTRADOR' as const };

  function preparar() {
    let guardado: unknown = null;
    const organizaciones = {
      findActivaById: jest.fn().mockResolvedValue({ id: 'org' }),
      obtenerPipelineConfig: jest
        .fn()
        .mockImplementation(() => Promise.resolve(guardado)),
      actualizarPipelineConfig: jest
        .fn()
        .mockImplementation((_id, config: unknown) => {
          guardado = config;
          return Promise.resolve();
        }),
    } as unknown as OrganizacionesRepository;
    const config = pipelineConfigPorDefecto();
    for (const tipo of ['COMPRA', 'VENTA', 'OTRO'] as const) {
      config[tipo].estados.splice(1, 0, 'EN_SEGUIMIENTO');
      config[tipo].etiquetas!.EN_SEGUIMIENTO = `Seguimiento ${tipo}`;
      config[tipo].transiciones.NUEVO = ['EN_SEGUIMIENTO'];
      config[tipo].transiciones.EN_SEGUIMIENTO = ['DESCARTADO'];
    }
    return {
      organizaciones,
      config,
      guardar: new ActualizarPipelineConfigUseCase(organizaciones),
      meta: new ObtenerMetaPipelineUseCase(organizaciones),
    };
  }

  it.each(['COMPRA', 'VENTA', 'OTRO'] as const)(
    'usa las etapas, etiquetas y transiciones guardadas de %s en ambos catálogos',
    async (tipo) => {
      const { guardar, meta, config, organizaciones } = preparar();
      await guardar.execute('org', 'usuario', config);
      const catalogo = await meta.execute('org', tipo);
      expect(catalogo.usandoOverride).toBe(true);
      expect(catalogo.estados.map((e) => e.codigo)).toEqual(
        config[tipo].estados,
      );
      expect(catalogo.estados[0].siguientes).toEqual(['EN_SEGUIMIENTO']);
      expect(catalogo.estados[1].etiqueta).toBe(`Seguimiento ${tipo}`);

      const leads = {
        listarParaTablero: jest.fn().mockResolvedValue({
          data: [
            { id: 'lead', tipoLead: tipo, estadoGestion: 'EN_SEGUIMIENTO' },
          ],
          total: 1,
          page: 1,
          pageSize: 100,
          totalPages: 1,
        }),
      } as unknown as LeadsLecturaRepository;
      const tablero = await new ListarTableroLeadsUseCase(
        leads,
        organizaciones,
      ).execute('org', tipo, undefined, ctx);
      expect(tablero.columnas.map((c) => c.codigo)).toEqual(
        config[tipo].estados,
      );
      expect(tablero.columnas[1]).toMatchObject({
        etiqueta: `Seguimiento ${tipo}`,
        leads: [{ id: 'lead' }],
      });
      expect(tablero.total).toBe(1);

      await guardar.execute('org', 'usuario', null);
      const restaurado = await meta.execute('org', tipo);
      expect(restaurado.usandoOverride).toBe(false);
      expect(restaurado.estados.map((e) => e.codigo)).toEqual(
        pipelineConfigPorDefecto()[tipo].estados,
      );
    },
  );

  it('conserva leads en etapas eliminadas y deja los cierres al final del embudo unificado', async () => {
    const { guardar, config, organizaciones } = preparar();
    await guardar.execute('org', 'usuario', config);
    const rows = [
      { id: 'anterior', tipoLead: 'COMPRA', estadoGestion: 'ETAPA_ELIMINADA' },
      { id: 'actual', tipoLead: 'VENTA', estadoGestion: 'EN_SEGUIMIENTO' },
    ] as LeadTableroRow[];
    const leads = {
      listarParaTablero: jest.fn().mockResolvedValue({ data: rows, total: 2 }),
    } as unknown as LeadsLecturaRepository;
    const tablero = await new ListarTableroLeadsUseCase(
      leads,
      organizaciones,
    ).execute('org', undefined, undefined, ctx);
    expect(tablero.columnas.flatMap((c) => c.leads)).toHaveLength(2);
    expect(
      tablero.columnas.find((c) => c.codigo === 'ETAPA_ELIMINADA')?.leads[0].id,
    ).toBe('anterior');
    const configuradas = tablero.columnas.filter(
      (c) => c.codigo !== 'ETAPA_ELIMINADA',
    );
    expect(configuradas.slice(-3).map((c) => c.codigo)).toEqual([
      ...ESTADOS_TERMINALES,
    ]);
  });

  it('el cambio de estado acepta una etapa personalizada y rechaza una transición desactivada', async () => {
    const { guardar, config, organizaciones } = preparar();
    await guardar.execute('org', 'usuario', config);
    const leads = {
      buscarParaGestion: jest
        .fn()
        .mockResolvedValue({
          id: 'lead',
          nombre: 'Lead',
          asignadoUsuarioId: null,
          tipoLead: 'COMPRA',
          estadoGestion: 'NUEVO',
        }),
      actualizarGestion: jest.fn().mockResolvedValue(undefined),
    };
    type Dependencias = ConstructorParameters<
      typeof ActualizarGestionLeadUseCase
    >;
    const gestionar = new ActualizarGestionLeadUseCase(
      leads as unknown as Dependencias[0],
      {} as Dependencias[1],
      {} as Dependencias[2],
      organizaciones,
      {} as Dependencias[4],
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as unknown as Dependencias[5],
    );
    await gestionar.execute(
      'org',
      'lead',
      { estadoGestion: 'EN_SEGUIMIENTO' },
      ctx,
    );
    expect(leads.actualizarGestion).toHaveBeenCalledWith(
      'org',
      'lead',
      expect.objectContaining({ estadoGestion: 'EN_SEGUIMIENTO' }),
      'usuario',
      expect.objectContaining({ desde: 'NUEVO', hacia: 'EN_SEGUIMIENTO' }),
    );
    leads.actualizarGestion.mockClear();
    await expect(
      gestionar.execute('org', 'lead', { estadoGestion: 'CONTACTADO' }, ctx),
    ).rejects.toThrow('No se puede pasar de NUEVO a CONTACTADO');
    expect(leads.actualizarGestion).not.toHaveBeenCalled();
  });
});
