import { Inject, Injectable, Logger } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoMensajeWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import type { ResultadoProcesarMensajeWhatsApp } from './procesar-mensaje-whatsapp-entrante.use-case';

/** Coexistencia (`smb_message_echoes`): el negocio respondió desde la app
 * WhatsApp Business (celular o dispositivo vinculado). Se persiste como
 * saliente — mismo wamid que Meta, sin notificar ni subir no_leidos.
 *
 * Idempotente por wamid: si el mensaje ya se mandó desde el CRM y Meta
 * también emite eco (o reintenta el webhook), no se duplica. */
@Injectable()
export class ProcesarEcoMensajeWhatsAppUseCase {
  private readonly logger = new Logger(ProcesarEcoMensajeWhatsAppUseCase.name);

  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    evento: EventoMensajeWhatsApp,
  ): Promise<ResultadoProcesarMensajeWhatsApp> {
    const conexion = await this.conexiones.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) {
      return { procesado: false };
    }

    const { id: conversacionId } =
      await this.conversaciones.findOCrearConversacion({
        organizacionId: conexion.organizacionId,
        whatsappConexionId: conexion.id,
        waId: evento.waId,
        nombreContacto: evento.nombreContacto,
      });

    const media = evento.media
      ? await this.descargarMediaSiPosible(
          conexion.organizacionId,
          evento.media.mediaId,
        )
      : undefined;

    const respondeAMensajeId = evento.respondeAWamid
      ? ((await this.conversaciones.buscarIdPorWamid(
          conexion.organizacionId,
          evento.respondeAWamid,
        )) ?? undefined)
      : undefined;

    const { creado } = await this.conversaciones.registrarMensaje({
      organizacionId: conexion.organizacionId,
      whatsappConversacionId: conversacionId,
      wamid: evento.wamid,
      direccion: 'saliente',
      tipo: evento.tipo,
      texto: evento.texto,
      estadoEntrega: 'enviado',
      datosCrudos: evento.raw,
      fechaMensaje: evento.timestamp,
      mediaId: evento.media?.mediaId,
      mediaMimeType: media?.mimeType ?? evento.media?.mimeType,
      mediaNombreArchivo: evento.media?.nombreArchivo,
      mediaCaption: evento.media?.caption,
      mediaEsVoz: evento.media?.esVoz,
      mediaTamanoBytes: media?.buffer.length,
      mediaBytes: media?.buffer,
      respondeAMensajeId,
      ubicacionLatitud: evento.ubicacion?.latitud,
      ubicacionLongitud: evento.ubicacion?.longitud,
      ubicacionNombre: evento.ubicacion?.nombre,
      ubicacionDireccion: evento.ubicacion?.direccion,
      contactos: evento.contactos,
    });

    if (creado) {
      await this.conversaciones.actualizarTrasSaliente(
        conversacionId,
        evento.timestamp,
      );
    }

    return {
      procesado: true,
      organizacionId: conexion.organizacionId,
      conversacionId,
    };
  }

  private async descargarMediaSiPosible(
    organizacionId: string,
    mediaId: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | undefined> {
    try {
      const conexionMeta =
        await this.conexionesMeta.findActivaPorOrganizacion(organizacionId);
      if (!conexionMeta?.tokenCifrado) return undefined;
      const accessToken = this.tokenEncryption.decrypt(
        conexionMeta.tokenCifrado,
      );
      return await this.graph.descargarMediaWhatsApp(mediaId, accessToken);
    } catch (error) {
      this.logger.error(
        `No se pudo descargar el media ${mediaId} de un eco WhatsApp`,
        error instanceof Error ? error.stack : error,
      );
      return undefined;
    }
  }
}
