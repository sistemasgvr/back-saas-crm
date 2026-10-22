import { Inject, Injectable, Logger } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoPreferenciaMarketingWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-cuenta';
import { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';

/**
 * `user_preferences`: el contacto tocó "Dejar de recibir marketing" (o lo
 * reactivó) en WhatsApp. Meta deja de entregar plantillas MARKETING a ese
 * contacto, así que se avisa a quien atiende el chat para no insistir.
 *
 * No se guarda como mensaje del chat a propósito: no tiene wamid real y
 * rompería la confirmación de lectura / respuestas citadas que usan el último
 * wamid entrante. El payload omite `whatsappConversacionId` para que el front
 * no la trate como un mensaje nuevo (agrupación de avisos de chat).
 */
@Injectable()
export class ProcesarPreferenciaMarketingWhatsAppUseCase {
  private readonly logger = new Logger(
    ProcesarPreferenciaMarketingWhatsAppUseCase.name,
  );

  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  async execute(evento: EventoPreferenciaMarketingWhatsApp): Promise<void> {
    const conexion = await this.conexiones.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) {
      this.logger.warn(
        `Preferencia de marketing para phone_number_id ${evento.phoneNumberId} sin línea vinculada`,
      );
      return;
    }

    const conversacionId = await this.conversaciones.buscarIdPorContacto({
      organizacionId: conexion.organizacionId,
      whatsappConexionId: conexion.id,
      waId: evento.waId,
      bsuid: evento.bsuid,
    });
    if (!conversacionId) {
      this.logger.log(
        `Preferencia de marketing (${evento.valor}) de un contacto sin chat en el CRM`,
      );
      return;
    }

    const conversacion = await this.conversaciones.findPorId(
      conexion.organizacionId,
      conversacionId,
    );
    const contacto =
      conversacion?.lead?.nombre ??
      conversacion?.nombreContacto ??
      (evento.waId ? `+${evento.waId}` : 'Un contacto');
    // Responsable del chat: quien tiene el control, si no el asesor del lead;
    // sin ninguno, los administradores.
    const responsable =
      conversacion?.controlUsuarioId ??
      conversacion?.lead?.asignadoUsuarioId ??
      null;

    await this.crearNotificacion.execute({
      organizacionId: conexion.organizacionId,
      tipo: 'WHATSAPP_PREFERENCIA',
      titulo:
        evento.valor === 'stop'
          ? `${contacto} no quiere recibir marketing`
          : `${contacto} volvió a aceptar marketing`,
      mensaje:
        evento.valor === 'stop'
          ? 'Pidió en WhatsApp dejar de recibir mensajes de marketing: Meta no le entregará plantillas de marketing. Puedes seguir respondiéndole en la ventana de 24 h o con plantillas de utilidad.'
          : 'Volvió a aceptar mensajes de marketing en WhatsApp.',
      payload: {
        url: `/chats/${conversacionId}`,
        conversacionId,
        preferencia: evento.valor,
      },
      ...(responsable
        ? { usuarioIds: [responsable] }
        : { roles: ['PROPIETARIO', 'ADMINISTRADOR'] }),
    });
  }
}
