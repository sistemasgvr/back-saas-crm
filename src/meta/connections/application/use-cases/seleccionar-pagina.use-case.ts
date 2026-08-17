import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../ports/meta-graph-client.port';
import type { MetaGraphClient } from '../ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { toConexionResponse } from '../conexion-response.mapper';

@Injectable()
export class SeleccionarPaginaUseCase {
  private readonly logger = new Logger(SeleccionarPaginaUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY) private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    pageId: string,
    pageNombre: string,
    usuarioEdicion: string,
  ) {
    const conexion = await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new BadRequestException('No hay una conexión Meta activa. Conecta Meta primero.');
    }
    if (!conexion.tokenCifrado) {
      throw new BadRequestException('Completa el OAuth de Meta antes de seleccionar una página.');
    }

    // Regla MVP: una página no puede pertenecer a dos empresas a la vez (PLAN.md §8.3).
    const enUso = await this.conexiones.findActivaPorPageId(pageId);
    if (enUso && enUso.organizacionId !== organizacionId) {
      throw new ConflictException('Esta página ya está conectada a otra organización');
    }

    const actualizada = await this.conexiones.actualizarPagina(
      conexion.id,
      pageId,
      pageNombre,
      usuarioEdicion,
    );

    const userAccessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const pageAccessToken = await this.graph.obtenerAccessTokenPagina(pageId, userAccessToken);
    if (!pageAccessToken) {
      throw new BadGatewayException(
        'No se pudo obtener el token de la página. Verifica permisos de pages_show_list y pages_manage_metadata.',
      );
    }

    try {
      await this.graph.suscribirPaginaLeadgen(pageId, pageAccessToken);
    } catch (error) {
      this.logger.error(
        `Suscripción leadgen falló para page_id ${pageId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }

    return toConexionResponse(actualizada);
  }
}
