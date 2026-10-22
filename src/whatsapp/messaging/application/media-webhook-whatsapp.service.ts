import { Inject, Injectable, Logger } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../meta/connections/application/ports/meta-graph-client.port';
import { esRechazoMeta } from '../../../meta/connections/application/mapear-error-meta-graph';
import { TokenEncryptionService } from '../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from './ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from './ports/whatsapp-conversaciones.repository.port';
import { GuardarMediaWhatsAppService } from './guardar-media-whatsapp.service';
import { TiempoRealChatsService } from './tiempo-real-chats.service';

/** Falla transitoria al bajar/guardar el archivo de un mensaje ya guardado.
 * El webhook responde 503 y Meta lo reintenta (con backoff, hasta días):
 * el mensaje ya existe, así que en el reintento solo se completa el archivo. */
export class MediaPendienteError extends Error {
  constructor(wamid: string, causa?: unknown) {
    super(
      `Archivo del mensaje ${wamid} pendiente: ${causa instanceof Error ? causa.message : 'falla transitoria'}`,
    );
    this.name = 'MediaPendienteError';
  }
}

export interface CompletarMediaInput {
  organizacionId: string;
  conversacionId: string;
  mensajeId: string;
  wamid: string;
  mediaId: string;
  mimeTypeWebhook?: string;
}

/**
 * Baja de Meta el archivo de un mensaje del webhook (entrante o eco) y lo
 * vincula en MinIO. Se llama DESPUÉS de guardar y notificar el mensaje: el
 * aviso al asesor no espera la descarga (audio/video pueden tardar segundos).
 *
 * - Meta rechaza (4xx: expirado, borrado, sin permiso): se registra y queda
 *   la referencia de Meta sin bytes — reintentar no lo arreglaría.
 * - Red, 5xx o MinIO caído: MediaPendienteError → reintento del webhook.
 */
@Injectable()
export class MediaWebhookWhatsAppService {
  private readonly logger = new Logger(MediaWebhookWhatsAppService.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly guardarMedia: GuardarMediaWhatsAppService,
    private readonly tiempoReal: TiempoRealChatsService,
  ) {}

  async completar(input: CompletarMediaInput): Promise<void> {
    if (!(await this.conversaciones.tieneMediaPendiente(input.mensajeId))) {
      return;
    }

    const conexionMeta = await this.conexionesMeta.findActivaPorOrganizacion(
      input.organizacionId,
    );
    if (!conexionMeta?.tokenCifrado) {
      this.logger.warn(
        `Sin sesión de Meta para bajar el archivo del mensaje ${input.wamid}`,
      );
      return;
    }
    const accessToken = this.tokenEncryption.decrypt(conexionMeta.tokenCifrado);

    let descargado: { buffer: Buffer; mimeType: string };
    try {
      descargado = await this.graph.descargarMediaWhatsApp(
        input.mediaId,
        accessToken,
      );
    } catch (error) {
      if (esRechazoMeta(error)) {
        this.logger.warn(
          `Meta rechazó el archivo ${input.mediaId} del mensaje ${input.wamid}; queda sin bytes`,
          error instanceof Error ? error.message : error,
        );
        return;
      }
      throw new MediaPendienteError(input.wamid, error);
    }

    let objeto: { id: string; mimeType: string; tamanoBytes: number };
    try {
      objeto = await this.guardarMedia.asegurar(
        input.organizacionId,
        descargado.buffer,
        descargado.mimeType ??
          input.mimeTypeWebhook ??
          'application/octet-stream',
      );
    } catch (error) {
      throw new MediaPendienteError(input.wamid, error);
    }

    await this.conversaciones.adjuntarMedia(input.mensajeId, {
      mediaObjetoId: objeto.id,
      mimeType: objeto.mimeType,
      tamanoBytes: objeto.tamanoBytes,
    });
    this.tiempoReal.notificar(
      input.organizacionId,
      input.conversacionId,
      'media',
    );
  }
}
