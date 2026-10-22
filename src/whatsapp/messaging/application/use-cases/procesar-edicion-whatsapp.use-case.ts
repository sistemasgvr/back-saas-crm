import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import { TiempoRealChatsService } from '../tiempo-real-chats.service';
import type { EventoEdicionWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';

/** El contacto editó un mensaje que ya nos había mandado — pisa el texto/
 * caption de esa fila con el contenido nuevo. No crea un mensaje de chat
 * nuevo ni guarda historial (WhatsApp tampoco lo expone). */
@Injectable()
export class ProcesarEdicionWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly tiempoReal: TiempoRealChatsService,
  ) {}

  async execute(evento: EventoEdicionWhatsApp): Promise<void> {
    const conexion = await this.conexiones.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) return;

    const conversacionId = await this.conversaciones.actualizarMensajeEditado(
      conexion.organizacionId,
      evento.wamidOriginal,
      { texto: evento.texto, mediaCaption: evento.mediaCaption },
      evento.fechaEdicion,
    );
    if (conversacionId) {
      this.tiempoReal.notificar(
        conexion.organizacionId,
        conversacionId,
        'edicion',
      );
    }
  }
}
