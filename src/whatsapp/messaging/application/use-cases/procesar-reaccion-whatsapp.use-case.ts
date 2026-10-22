import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import { TiempoRealChatsService } from '../tiempo-real-chats.service';
import type { EventoReaccionWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';

/** El contacto reaccionó (o sacó su reacción) a un mensaje NUESTRO. Solo
 * pega el emoji sobre esa fila — no crea un mensaje de chat nuevo. */
@Injectable()
export class ProcesarReaccionWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly tiempoReal: TiempoRealChatsService,
  ) {}

  async execute(evento: EventoReaccionWhatsApp): Promise<void> {
    const conexion = await this.conexiones.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) return;

    const conversacionId = await this.conversaciones.actualizarReaccionCliente(
      conexion.organizacionId,
      evento.wamidObjetivo,
      evento.emoji || null,
    );
    if (conversacionId) {
      this.tiempoReal.notificar(
        conexion.organizacionId,
        conversacionId,
        'reaccion',
      );
    }
  }
}
