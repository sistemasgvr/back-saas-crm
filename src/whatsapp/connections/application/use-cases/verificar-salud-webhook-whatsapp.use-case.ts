import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA } from '../../domain/campos-webhook-whatsapp';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';

export interface ResultadoSaludWebhookWhatsapp {
  webhookSuscrito: boolean;
  camposSuscritos: string[];
  camposFaltantes: string[];
  webhookUltimoError: string | null;
}

/** Health-check contra Graph `/{wabaId}/subscribed_apps`. Si Graph expone
 * `subscribed_fields`, valida los de coexistencia; si viene vacío, solo
 * confirma que nuestra app está suscrita (los fields suelen vivir en el Dashboard). */
@Injectable()
export class VerificarSaludWebhookWhatsappUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly metaConexiones: MetaConexionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    _usuarioEdicion: string,
  ): Promise<ResultadoSaludWebhookWhatsapp> {
    const conexionWa = await this.whatsappConexiones.findPorId(
      organizacionId,
      id,
    );
    if (!conexionWa) {
      throw new NotFoundException('Conexión de WhatsApp no encontrada');
    }

    const metaConexion =
      await this.metaConexiones.findActivaPorOrganizacion(organizacionId);
    if (!metaConexion?.tokenCifrado || !metaConexion.appId) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(metaConexion.tokenCifrado);

    let suscrito = false;
    let error: string | null = null;
    let camposSuscritos: string[] = [];
    let camposFaltantes: string[] = [];

    try {
      const apps = await this.graph.obtenerAppsSuscritasWaba(
        conexionWa.wabaId,
        accessToken,
      );
      const nuestraApp = apps.find((app) => app.id === metaConexion.appId);
      suscrito = !!nuestraApp;
      camposSuscritos = nuestraApp?.camposSuscritos ?? [];

      if (!suscrito) {
        error =
          'La app no está suscrita al WABA en Meta — usa "Re-suscribir webhook"';
        // No inventamos campos faltantes: Graph WABA no lista fields aquí.
      } else if (camposSuscritos.length > 0) {
        camposFaltantes = CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA.filter(
          (c) => !camposSuscritos.includes(c),
        );
        if (camposFaltantes.length > 0) {
          error = `Faltan campos de webhook en Meta: ${camposFaltantes.join(', ')}`;
        }
      }
      // Si la app está suscrita y Graph no expone subscribed_fields (caso normal),
      // el check de fields se hace en Meta App Dashboard, no vía este endpoint.
    } catch (graphError) {
      error =
        graphError instanceof Error
          ? graphError.message
          : 'Error desconocido al verificar en Meta';
    }

    await this.whatsappConexiones.marcarWebhookCheck(
      conexionWa.id,
      suscrito,
      error,
    );

    return {
      webhookSuscrito: suscrito,
      camposSuscritos,
      camposFaltantes: [...camposFaltantes],
      webhookUltimoError: error,
    };
  }
}
