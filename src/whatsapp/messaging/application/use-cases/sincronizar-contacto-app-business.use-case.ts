import { Inject, Injectable, Logger } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoContactoAppWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-cuenta';

/** Coexistencia (`smb_app_state_sync`): cuando el negocio guarda o edita un
 * contacto en la app WhatsApp Business, ese nombre pasa al chat del CRM —
 * igual que lo ve en el celular. No crea chats nuevos (la libreta puede tener
 * cientos de contactos sin conversación) y un contacto borrado no se toca. */
@Injectable()
export class SincronizarContactoAppBusinessUseCase {
  private readonly logger = new Logger(
    SincronizarContactoAppBusinessUseCase.name,
  );

  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(evento: EventoContactoAppWhatsApp): Promise<boolean> {
    if (evento.accion !== 'add' || !evento.nombre) return false;

    const conexion = await this.conexiones.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) {
      this.logger.warn(
        `Contacto de la app Business para phone_number_id ${evento.phoneNumberId} sin línea vinculada`,
      );
      return false;
    }

    return this.conversaciones.actualizarNombreDesdeContactoApp({
      organizacionId: conexion.organizacionId,
      whatsappConexionId: conexion.id,
      waId: evento.waId,
      nombre: evento.nombre.slice(0, 200),
    });
  }
}
