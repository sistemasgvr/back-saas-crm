import { ConflictException } from '@nestjs/common';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import type { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';
import { VincularPaginaUseCase } from './vincular-pagina.use-case';

function fixture(organizacionActiva: string | null) {
  const conexiones = {
    findActivaPorOrganizacion: jest.fn().mockResolvedValue({
      id: 'conexion',
      tokenCifrado: 'cifrado',
    }),
  };
  const paginas = {
    findActivaPorPageId: jest
      .fn()
      .mockResolvedValue(
        organizacionActiva ? { organizacionId: organizacionActiva } : null,
      ),
    vincular: jest.fn().mockResolvedValue({ id: 'pagina-nueva' }),
  };
  const graph = {
    obtenerAccessTokenPagina: jest.fn().mockResolvedValue('token-pagina'),
    suscribirPaginaLeadgen: jest.fn().mockResolvedValue(undefined),
  };
  const encryption = {
    decrypt: jest.fn().mockReturnValue('token-usuario'),
    encrypt: jest.fn().mockReturnValue('token-pagina-cifrado'),
  };
  const useCase = new VincularPaginaUseCase(
    conexiones as unknown as MetaConexionesRepository,
    paginas as unknown as MetaPaginasRepository,
    graph as unknown as MetaGraphClient,
    encryption as unknown as TokenEncryptionService,
  );
  return { useCase, paginas, graph };
}

describe('VincularPaginaUseCase', () => {
  it('rechaza la página de otra organización antes de modificar su webhook', async () => {
    const { useCase, paginas, graph } = fixture('otra-org');
    await expect(
      useCase.execute('org', 'page-2', 'Impulsa', 'admin'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(graph.obtenerAccessTokenPagina).not.toHaveBeenCalled();
    expect(graph.suscribirPaginaLeadgen).not.toHaveBeenCalled();
    expect(paginas.vincular).not.toHaveBeenCalled();
  });

  it.each([null, 'org'])(
    'permite agregar o revincular una página propia (%s)',
    async (activa) => {
      const { useCase, paginas, graph } = fixture(activa);
      await useCase.execute('org', 'page-2', 'Impulsa', 'admin');
      expect(graph.suscribirPaginaLeadgen).toHaveBeenCalledWith(
        'page-2',
        'token-pagina',
      );
      expect(paginas.vincular).toHaveBeenCalledWith(
        expect.objectContaining({
          organizacionId: 'org',
          pageId: 'page-2',
          webhookSuscrito: true,
        }),
      );
    },
  );
});
