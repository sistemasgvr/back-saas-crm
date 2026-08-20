import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import { META_PAGINAS_REPOSITORY } from '../ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';

export interface ResultadoSaludWebhook {
  webhookSuscrito: boolean;
  webhookUltimoError: string | null;
}

/** Health-check contra Meta (PLAN-FASE-14 §4.4) — a diferencia del flag local
 * `webhookSuscrito` (que solo refleja la última vez que NOSOTROS suscribimos/resuscribimos),
 * esto consulta el estado real en Graph vía subscribed_apps. */
@Injectable()
export class VerificarSaludWebhookPaginaUseCase {
  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly notificaciones: CrearNotificacionUseCase,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<ResultadoSaludWebhook> {
    const pagina = await this.paginas.findPorId(organizacionId, id);
    if (!pagina) {
      throw new NotFoundException('Página no encontrada');
    }

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado || !conexion.appId) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const userAccessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const pageAccessToken = await this.graph.obtenerAccessTokenPagina(
      pagina.pageId,
      userAccessToken,
    );

    let suscrito = false;
    let error: string | null = null;

    if (!pageAccessToken) {
      error =
        'No se pudo obtener el token de la página — verifica los permisos otorgados en Meta';
    } else {
      try {
        const apps = await this.graph.obtenerAppsSuscritas(
          pagina.pageId,
          pageAccessToken,
        );
        const nuestraApp = apps.find((app) => app.id === conexion.appId);
        suscrito = nuestraApp?.camposSuscritos.includes('leadgen') ?? false;
        if (!suscrito) {
          error =
            'La app no está suscrita al campo leadgen en Meta — usa "Re-suscribir webhook"';
        }
      } catch (graphError) {
        error =
          graphError instanceof Error
            ? graphError.message
            : 'Error desconocido al verificar en Meta';
      }
    }

    await this.paginas.actualizarSaludWebhook(
      pagina.id,
      suscrito,
      error,
      usuarioEdicion,
    );

    if (!suscrito) {
      await this.notificaciones.execute({
        organizacionId,
        tipo: 'META_WEBHOOK_SALUD',
        titulo: `Webhook de "${pagina.nombre}" con problemas`,
        mensaje:
          error ??
          'La página no está recibiendo leads en vivo — revisa la suscripción del webhook.',
        payload: {
          metaPaginaId: pagina.id,
          pageId: pagina.pageId,
          nombre: pagina.nombre,
        },
      });
    }

    return { webhookSuscrito: suscrito, webhookUltimoError: error };
  }
}
