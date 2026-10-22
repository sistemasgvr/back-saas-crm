import { ControlAtencionService } from '../control-atencion.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoMensajeWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';
import type { ResultadoProcesarMensajeWhatsApp } from './procesar-mensaje-whatsapp-entrante.use-case';
import { MediaWebhookWhatsAppService } from '../media-webhook-whatsapp.service';
import { TiempoRealChatsService } from '../tiempo-real-chats.service';

/** Coexistencia (`smb_message_echoes`): el negocio respondió desde la app
 * WhatsApp Business (celular o dispositivo vinculado). Se persiste como
 * saliente — mismo wamid que Meta, sin notificar ni subir no_leidos.
 *
 * Idempotente por wamid: si el mensaje ya se mandó desde el CRM y Meta
 * también emite eco (o reintenta el webhook), no se duplica. Igual que el
 * entrante: se guarda y avisa en vivo primero, y el archivo se baja después
 * (con reintento del webhook si falla por algo transitorio). */
@Injectable()
export class ProcesarEcoMensajeWhatsAppUseCase {
  private readonly logger = new Logger(ProcesarEcoMensajeWhatsAppUseCase.name);

  constructor(
    private readonly control: ControlAtencionService,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly media: MediaWebhookWhatsAppService,
    private readonly tiempoReal: TiempoRealChatsService,
  ) {}

  async execute(
    evento: EventoMensajeWhatsApp,
  ): Promise<ResultadoProcesarMensajeWhatsApp> {
    const conexion = await this.conexiones.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) {
      this.logger.warn(
        `Webhook eco WhatsApp ignorado: phone_number_id ${evento.phoneNumberId} sin conexión activa`,
      );
      return { procesado: false };
    }

    const { id: conversacionId } =
      await this.conversaciones.findOCrearConversacion({
        organizacionId: conexion.organizacionId,
        whatsappConexionId: conexion.id,
        waId: evento.waId,
        bsuid: evento.bsuid,
        username: evento.username,
        nombreContacto: evento.nombreContacto,
      });

    const autorTipo = await this.control.ecoExterno(
      conexion.organizacionId,
      conversacionId,
      evento.wamid,
      evento.esHistorial === true,
    );

    const respondeAMensajeId = evento.respondeAWamid
      ? ((await this.conversaciones.buscarIdPorWamid(
          conexion.organizacionId,
          evento.respondeAWamid,
        )) ?? undefined)
      : undefined;

    const { id: mensajeId, creado } =
      await this.conversaciones.registrarMensaje({
        organizacionId: conexion.organizacionId,
        whatsappConversacionId: conversacionId,
        wamid: evento.wamid,
        direccion: 'saliente',
        autorTipo,
        tipo: evento.tipo,
        texto: evento.texto,
        estadoEntrega: 'enviado',
        datosCrudos: evento.raw,
        fechaMensaje: evento.timestamp,
        mediaId: evento.media?.mediaId,
        mediaMimeType: evento.media?.mimeType,
        mediaNombreArchivo: evento.media?.nombreArchivo,
        mediaCaption: evento.media?.caption,
        mediaEsVoz: evento.media?.esVoz,
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
        { limpiarNoLeidos: evento.esHistorial !== true },
      );
      this.tiempoReal.notificar(conexion.organizacionId, conversacionId, 'eco');
    }

    if (evento.media?.mediaId) {
      await this.media.completar({
        organizacionId: conexion.organizacionId,
        conversacionId,
        mensajeId,
        wamid: evento.wamid,
        mediaId: evento.media.mediaId,
        mimeTypeWebhook: evento.media.mimeType,
      });
    }

    return {
      procesado: true,
      organizacionId: conexion.organizacionId,
      conversacionId,
    };
  }
}
