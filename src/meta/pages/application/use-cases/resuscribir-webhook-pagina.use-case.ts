import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_PAGINAS_REPOSITORY } from '../ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';

/** Reintenta la suscripción leadgen — re-obtiene el page access token con el user token vigente. */
@Injectable()
export class ResuscribirWebhookPaginaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string, id: string, usuarioEdicion: string) {
    const pagina = await this.paginas.findPorId(organizacionId, id);
    if (!pagina) {
      throw new NotFoundException('Página no encontrada');
    }

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const userAccessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const pageAccessToken = await this.graph.obtenerAccessTokenPagina(
      pagina.pageId,
      userAccessToken,
    );
    if (!pageAccessToken) {
      throw new NotFoundException(
        'No se pudo obtener el token de la página — verifica los permisos otorgados en Meta',
      );
    }

    await this.graph.suscribirPaginaLeadgen(pagina.pageId, pageAccessToken);
    await this.paginas.vincular({
      organizacionId,
      metaConexionId: pagina.metaConexionId,
      pageId: pagina.pageId,
      nombre: pagina.nombre,
      tokenPaginaCifrado: this.tokenEncryption.encrypt(pageAccessToken),
      webhookSuscrito: true,
      usuarioEdicion,
    });

    return { ok: true };
  }
}
