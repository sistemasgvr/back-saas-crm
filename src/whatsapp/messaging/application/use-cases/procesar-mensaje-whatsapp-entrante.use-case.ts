import { Inject, Injectable, Logger } from '@nestjs/common';
import { ControlAtencionService } from '../control-atencion.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoMensajeWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';
import { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import {
  previewUltimoMensajeWhatsApp,
  truncarConEllipsis,
} from '../preview-ultimo-mensaje';
import { AsegurarLeadParaConversacionWhatsAppUseCase } from './asegurar-lead-para-conversacion-whatsapp.use-case';
import { MediaWebhookWhatsAppService } from '../media-webhook-whatsapp.service';
import { TiempoRealChatsService } from '../tiempo-real-chats.service';

export interface ResultadoProcesarMensajeWhatsApp {
  procesado: boolean;
  organizacionId?: string;
  conversacionId?: string;
}

/** Análogo a ProcesarLeadEntranteUseCase pero para mensajes WA — resuelve la
 * org por phone_number_id, crea/reusa la conversación, asegura lead +
 * autoasignación si hace falta, guarda el mensaje (idempotente por wamid) y
 * notifica al dueño del lead si hay uno.
 *
 * Orden pensado para latencia: guardar → aviso en vivo a la org → notificación
 * (WS + Web Push) → recién entonces bajar el archivo de Meta, que puede tardar
 * segundos en audio/video. El media_id del webhook dura 7 días: si la descarga
 * falla por algo transitorio, MediaPendienteError hace que el webhook responda
 * 503 y Meta lo reintente; en el reintento el mensaje ya existe y solo se
 * completa el archivo (sin volver a notificar). */
@Injectable()
export class ProcesarMensajeWhatsAppEntranteUseCase {
  private readonly logger = new Logger(
    ProcesarMensajeWhatsAppEntranteUseCase.name,
  );

  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
    private readonly asegurarLead: AsegurarLeadParaConversacionWhatsAppUseCase,
    private readonly control: ControlAtencionService,
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
        `Webhook WhatsApp entrante ignorado: phone_number_id ${evento.phoneNumberId} sin conexión activa`,
      );
      return { procesado: false };
    }

    const { id: conversacionId, esNueva } =
      await this.conversaciones.findOCrearConversacion({
        organizacionId: conexion.organizacionId,
        whatsappConexionId: conexion.id,
        waId: evento.waId,
        bsuid: evento.bsuid,
        username: evento.username,
        nombreContacto: evento.nombreContacto,
      });

    // Lead primero: así WHATSAPP_MENSAJE ya va al asesor autoasignado.
    // History sync no crea/asegura leads ni notifica (solo rellena el hilo).
    if (evento.esHistorial !== true) {
      try {
        await this.asegurarLead.execute(
          conexion.organizacionId,
          conversacionId,
        );
      } catch (error: unknown) {
        this.logger.error(
          `No se pudo asegurar lead para conversación ${conversacionId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    // El webhook solo trae el wamid del mensaje citado — hace falta el id
    // propio para guardar la relación (self-relation por id, no por wamid).
    // Si no se encuentra (mensaje muy viejo, o cita un mensaje que no es
    // nuestro), simplemente no se guarda la cita — no es un error.
    const respondeAMensajeId = evento.respondeAWamid
      ? ((await this.conversaciones.buscarIdPorWamid(
          conexion.organizacionId,
          evento.respondeAWamid,
        )) ?? undefined)
      : undefined;

    // Sin bytes todavía: el archivo se vincula después de notificar.
    const { id: mensajeId, creado } =
      await this.conversaciones.registrarMensaje({
        organizacionId: conexion.organizacionId,
        whatsappConversacionId: conversacionId,
        wamid: evento.wamid,
        direccion: 'entrante',
        esHistorial: evento.esHistorial,
        tipo: evento.tipo,
        texto: evento.texto,
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

    const resultado: ResultadoProcesarMensajeWhatsApp = {
      procesado: true,
      organizacionId: conexion.organizacionId,
      conversacionId,
    };

    if (!creado) {
      // Meta reintentó un webhook ya procesado — no volver a incrementar
      // no_leidos ni notificar; solo completar el archivo si quedó pendiente.
      await this.completarMedia(
        evento,
        conexion.organizacionId,
        conversacionId,
        mensajeId,
      );
      return resultado;
    }

    const esHistorial = evento.esHistorial === true;
    await this.conversaciones.actualizarTrasEntrante(
      conversacionId,
      evento.timestamp,
      {
        incrementarNoLeidos: !esHistorial,
        extenderVentana: !esHistorial,
      },
    );
    // Cualquier pantalla abierta de la org refresca el chat al instante.
    this.tiempoReal.notificar(
      conexion.organizacionId,
      conversacionId,
      'mensaje',
    );

    if (!esHistorial) {
      if (esNueva) {
        await this.control.aplicarModoInicial(
          conexion.organizacionId,
          conversacionId,
        );
      }
      await this.notificar(evento, conexion.organizacionId, conversacionId);
    }

    await this.completarMedia(
      evento,
      conexion.organizacionId,
      conversacionId,
      mensajeId,
    );
    return resultado;
  }

  private async notificar(
    evento: EventoMensajeWhatsApp,
    organizacionId: string,
    conversacionId: string,
  ): Promise<void> {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );

    const preview =
      previewUltimoMensajeWhatsApp({
        texto: evento.texto,
        mediaCaption: evento.media?.caption,
        tipo: evento.tipo,
        mediaEsVoz: evento.media?.esVoz,
      }) ?? 'Nuevo mensaje';

    const titulo =
      conversacion?.lead?.nombre ??
      conversacion?.nombreContacto ??
      evento.nombreContacto ??
      (evento.username
        ? evento.username.startsWith('@')
          ? evento.username
          : `@${evento.username}`
        : null) ??
      (evento.waId ? `+${evento.waId}` : null) ??
      'WhatsApp';

    // Sin await: guardar + socket + push corren en paralelo a la descarga del
    // archivo. Un fallo se registra (antes se descartaba en silencio).
    void this.crearNotificacion
      .execute({
        organizacionId,
        tipo: 'WHATSAPP_MENSAJE',
        titulo,
        mensaje: truncarConEllipsis(preview, 120),
        payload: {
          whatsappConversacionId: conversacionId,
          url: `/chats/${conversacionId}`,
          /** Preview para pintar la lista de chats al instante en el front. */
          ultimoMensajeTexto: preview.slice(0, 200),
          /** Tras incrementar: el SW agrupa el toast del SO ("N mensajes · …"). */
          noLeidos: conversacion?.noLeidos ?? 1,
        },
        // Con lead asignado: solo a su dueño. Sin lead o sin asignar: toda
        // la org (nadie es responsable todavía, cualquiera puede tomarlo).
        usuarioIds: conversacion?.lead?.asignadoUsuarioId
          ? [conversacion.lead.asignadoUsuarioId]
          : undefined,
      })
      .catch((error: unknown) =>
        this.logger.error(
          `No se pudo crear la notificación del mensaje ${evento.wamid}`,
          error instanceof Error ? error.stack : error,
        ),
      );
  }

  private async completarMedia(
    evento: EventoMensajeWhatsApp,
    organizacionId: string,
    conversacionId: string,
    mensajeId: string,
  ): Promise<void> {
    if (!evento.media?.mediaId) return;
    await this.media.completar({
      organizacionId,
      conversacionId,
      mensajeId,
      wamid: evento.wamid,
      mediaId: evento.media.mediaId,
      mimeTypeWebhook: evento.media.mimeType,
    });
  }
}
