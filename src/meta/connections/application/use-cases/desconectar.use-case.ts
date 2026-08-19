import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../ports/meta-graph-client.port';
import type { MetaGraphClient } from '../ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';

/**
 * Desconexión total (PLAN-FASE-13-META-MULTI.md §4.7): desuscribe y desvincula
 * TODAS las páginas y cuentas de la org, y limpia la sesión OAuth — pero
 * conserva appId/appSecret (decisión aceptada en PLAN.md §15, sin cambios).
 */
@Injectable()
export class DesconectarUseCase {
  private readonly logger = new Logger(DesconectarUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string, usuarioEdicion: string): Promise<void> {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new NotFoundException('No hay una conexión Meta configurada');
    }

    const paginasDesvinculadas =
      await this.paginas.desvincularTodasDeOrganizacion(
        organizacionId,
        usuarioEdicion,
      );
    await Promise.allSettled(
      paginasDesvinculadas
        .filter((pagina) => pagina.tokenPaginaCifrado)
        .map(async (pagina) => {
          try {
            const pageAccessToken = this.tokenEncryption.decrypt(
              pagina.tokenPaginaCifrado!,
            );
            await this.graph.desuscribirPaginaLeadgen(
              pagina.pageId,
              pageAccessToken,
            );
          } catch (error) {
            this.logger.warn(
              `No se pudo desuscribir la página ${pagina.pageId} al desconectar Meta`,
              error instanceof Error ? error.stack : error,
            );
          }
        }),
    );

    await this.cuentas.desvincularTodasDeOrganizacion(
      organizacionId,
      usuarioEdicion,
    );
    await this.conexiones.limpiarConexionOAuth(conexion.id, usuarioEdicion);
  }
}
