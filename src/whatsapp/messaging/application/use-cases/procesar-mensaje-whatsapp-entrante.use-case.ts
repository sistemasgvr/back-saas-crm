import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoMensajeWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';
import { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';

export interface ResultadoProcesarMensajeWhatsApp {
  procesado: boolean;
  organizacionId?: string;
  conversacionId?: string;
}

/** Análogo a ProcesarLeadEntranteUseCase pero para mensajes WA — resuelve la
 * org por phone_number_id, crea/reusa la conversación, guarda el mensaje
 * (idempotente por wamid) y notifica al dueño del lead si hay uno. */
@Injectable()
export class ProcesarMensajeWhatsAppEntranteUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
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

    const { creado } = await this.conversaciones.registrarMensaje({
      organizacionId: conexion.organizacionId,
      whatsappConversacionId: conversacionId,
      wamid: evento.wamid,
      direccion: 'entrante',
      tipo: evento.tipo,
      texto: evento.texto,
      datosCrudos: evento.raw,
      fechaMensaje: evento.timestamp,
    });

    if (!creado) {
      // Meta reintentó un webhook ya procesado — no volver a incrementar no_leidos/notificar.
      return {
        procesado: true,
        organizacionId: conexion.organizacionId,
        conversacionId,
      };
    }

    await this.conversaciones.actualizarTrasEntrante(
      conversacionId,
      evento.timestamp,
      evento.nombreContacto,
    );

    const conversacion = await this.conversaciones.findPorId(
      conexion.organizacionId,
      conversacionId,
    );

    void this.crearNotificacion
      .execute({
        organizacionId: conexion.organizacionId,
        tipo: 'WHATSAPP_MENSAJE',
        titulo: 'Nuevo mensaje de WhatsApp',
        mensaje: conversacion?.lead
          ? `${conversacion.lead.nombre} te escribió por WhatsApp.`
          : `Mensaje nuevo de ${conversacion?.nombreContacto ?? evento.waId} — sin lead vinculado.`,
        payload: { whatsappConversacionId: conversacionId },
        // Con lead asignado: solo a su dueño. Sin lead o sin asignar: toda
        // la org (nadie es responsable todavía, cualquiera puede tomarlo).
        usuarioIds: conversacion?.lead?.asignadoUsuarioId
          ? [conversacion.lead.asignadoUsuarioId]
          : undefined,
      })
      .catch(() => undefined);

    return {
      procesado: true,
      organizacionId: conexion.organizacionId,
      conversacionId,
    };
  }
}
