import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { META_FORMULARIOS_REPOSITORY } from '../ports/meta-formularios.repository.port';
import type { MetaFormulariosRepository } from '../ports/meta-formularios.repository.port';

@Injectable()
export class SincronizarFormulariosPaginaUseCase {
  private readonly logger = new Logger(
    SincronizarFormulariosPaginaUseCase.name,
  );

  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_FORMULARIOS_REPOSITORY)
    private readonly formularios: MetaFormulariosRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    metaPaginaId: string,
    usuarioEdicion: string,
  ) {
    const pagina = await this.paginas.findPorId(organizacionId, metaPaginaId);
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

    const formsGraph = await this.graph.listarLeadgenForms(
      pagina.pageId,
      pageAccessToken,
    );

    let sincronizados = 0;
    for (const formGraph of formsGraph) {
      try {
        await this.formularios.upsertVinculado({
          organizacionId,
          metaPaginaId,
          formId: formGraph.id,
          nombre: formGraph.nombre,
          estadoMeta: formGraph.estado,
          locale: formGraph.locale,
          usuarioEdicion,
        });
        sincronizados += 1;
      } catch (error) {
        this.logger.warn(
          `Sync formularios: falló el form ${formGraph.id} de la página ${pagina.pageId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    return { sincronizados, total: formsGraph.length };
  }
}
