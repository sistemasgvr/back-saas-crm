import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA } from '../../domain/campos-webhook-whatsapp';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';

export interface ResultadoResyncWebhookWhatsapp {
  ok: true;
  camposSuscritos: string[];
  camposFaltantes: string[];
}

/** Reintenta POST /{wabaId}/subscribed_apps y reporta campos visibles en Graph. */
@Injectable()
export class ResuscribirWebhookWhatsappUseCase {
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
    usuarioEdicion: string,
  ): Promise<ResultadoResyncWebhookWhatsapp> {
    const conexionWa = await this.whatsappConexiones.findPorId(
      organizacionId,
      id,
    );
    if (!conexionWa) {
      throw new NotFoundException('Conexión de WhatsApp no encontrada');
    }

    const metaConexion =
      await this.metaConexiones.findActivaPorOrganizacion(organizacionId);
    if (!metaConexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(metaConexion.tokenCifrado);

    await this.graph.suscribirWabaWebhook(conexionWa.wabaId, accessToken);
    await this.whatsappConexiones.marcarWebhookSuscrito(
      conexionWa.id,
      usuarioEdicion,
    );

    let camposSuscritos: string[] = [];
    try {
      const apps = await this.graph.obtenerAppsSuscritasWaba(
        conexionWa.wabaId,
        accessToken,
      );
      const nuestraApp = metaConexion.appId
        ? apps.find((app) => app.id === metaConexion.appId)
        : apps[0];
      camposSuscritos = nuestraApp?.camposSuscritos ?? [];
    } catch {
      // La resuscripción ya quedó marcada; reportar campos vacíos si Graph falla.
      camposSuscritos = [];
    }

    // Si Graph no expone subscribed_fields, no inventamos faltantes
    // (la suscripción de fields vive en Meta App Dashboard).
    const camposFaltantes =
      camposSuscritos.length > 0
        ? CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA.filter(
            (c) => !camposSuscritos.includes(c),
          )
        : [];

    return {
      ok: true,
      camposSuscritos,
      camposFaltantes: [...camposFaltantes],
    };
  }
}
