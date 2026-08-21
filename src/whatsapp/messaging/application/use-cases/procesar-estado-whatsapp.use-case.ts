import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { EventoEstadoWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';

/** Actualiza enviado/entregado/leído/fallido de un mensaje SALIENTE ya guardado. */
@Injectable()
export class ProcesarEstadoWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(evento: EventoEstadoWhatsApp): Promise<void> {
    const conexion = await this.conexiones.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) return;

    await this.conversaciones.actualizarEstadoMensaje(
      conexion.organizacionId,
      evento.wamid,
      evento.status,
    );
  }
}
