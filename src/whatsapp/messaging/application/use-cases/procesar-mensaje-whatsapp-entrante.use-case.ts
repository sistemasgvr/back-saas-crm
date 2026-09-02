import { Inject, Injectable, Logger } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoMensajeWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';
import { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';

export interface ResultadoProcesarMensajeWhatsApp {
  procesado: boolean;
  organizacionId?: string;
  conversacionId?: string;
}

/** Análogo a ProcesarLeadEntranteUseCase pero para mensajes WA — resuelve la
 * org por phone_number_id, crea/reusa la conversación, guarda el mensaje
 * (idempotente por wamid) y notifica al dueño del lead si hay uno.
 *
 * Si el mensaje trae un archivo, lo descarga de Meta y lo persiste en el
 * mismo paso: el media_id que manda el webhook solo dura 7 días — si
 * esperáramos a que alguien lo abra en el CRM, podría ya no estar
 * disponible. Si la descarga falla (archivo muy viejo, Meta caído), el
 * mensaje igual se guarda — con la referencia de Meta pero sin bytes, en
 * vez de perder el mensaje entero. */
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
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
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

    const media = evento.media
      ? await this.descargarMediaSiPosible(
          conexion.organizacionId,
          evento.media.mediaId,
        )
      : undefined;

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

    const { creado } = await this.conversaciones.registrarMensaje({
      organizacionId: conexion.organizacionId,
      whatsappConversacionId: conversacionId,
      wamid: evento.wamid,
      direccion: 'entrante',
      tipo: evento.tipo,
      texto: evento.texto,
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
        `No se pudo descargar el media ${mediaId} de un mensaje entrante`,
        error instanceof Error ? error.stack : error,
      );
      return undefined;
    }
  }
}
