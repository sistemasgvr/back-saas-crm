import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_PAGINAS_REPOSITORY } from '../ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';

@Injectable()
export class VincularPaginaUseCase {
  private readonly logger = new Logger(VincularPaginaUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    pageId: string,
    pageNombre: string,
    usuarioEdicion: string,
  ) {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const userAccessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const pageAccessToken = await this.graph.obtenerAccessTokenPagina(
      pageId,
      userAccessToken,
    );

    let webhookSuscrito = false;
    if (pageAccessToken) {
      try {
        await this.graph.suscribirPaginaLeadgen(pageId, pageAccessToken);
        webhookSuscrito = true;
      } catch (error) {
        this.logger.warn(
          `No se pudo suscribir la página ${pageId} al webhook leadgen — se vinculó sin suscripción, reintentar con resync-webhook`,
          error instanceof Error ? error.stack : error,
        );
      }
    } else {
      this.logger.warn(
        `No se obtuvo access token de página para ${pageId} — se vincula sin token`,
      );
    }

    return this.paginas.vincular({
      organizacionId,
      metaConexionId: conexion.id,
      pageId,
      nombre: pageNombre,
      tokenPaginaCifrado: pageAccessToken
        ? this.tokenEncryption.encrypt(pageAccessToken)
        : null,
      webhookSuscrito,
      usuarioEdicion,
    });
  }
}
