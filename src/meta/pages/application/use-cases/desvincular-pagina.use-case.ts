import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_PAGINAS_REPOSITORY } from '../ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';

@Injectable()
export class DesvincularPaginaUseCase {
  private readonly logger = new Logger(DesvincularPaginaUseCase.name);

  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<void> {
    const pagina = await this.paginas.findPorId(organizacionId, id);
    if (!pagina) {
      throw new NotFoundException('Página no encontrada');
    }

    // Cargamos el token de página directo del repo (findPorId no lo expone) solo para el unsubscribe.
    const conConexion = await this.paginas.findActivaPorPageId(pagina.pageId);
    if (conConexion?.tokenPaginaCifrado) {
      try {
        const pageAccessToken = this.tokenEncryption.decrypt(
          conConexion.tokenPaginaCifrado,
        );
        await this.graph.desuscribirPaginaLeadgen(
          pagina.pageId,
          pageAccessToken,
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo desuscribir la página ${pagina.pageId} del webhook leadgen antes de desvincular`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    const desvinculada = await this.paginas.desvincular(
      organizacionId,
      id,
      usuarioEdicion,
    );
    if (!desvinculada) {
      throw new NotFoundException('Página no encontrada');
    }
  }
}
