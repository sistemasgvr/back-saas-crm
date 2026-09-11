import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type {
  MediaMensaje,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';
import { puedeVerConversacionWhatsApp } from '../../domain/acceso-conversacion-whatsapp';

/** Sirve los bytes de un archivo de un mensaje puntual — mismo control de
 * acceso que abrir la conversación (lectura para cualquier miembro de la org). */
@Injectable()
export class ObtenerMediaMensajeUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    conversacionId: string,
    mensajeId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<MediaMensaje> {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (!puedeVerConversacionWhatsApp(conversacion.lead, ctx)) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    const media = await this.conversaciones.obtenerMedia(
      organizacionId,
      mensajeId,
    );
    if (!media) {
      throw new NotFoundException(
        'El mensaje no existe o no tiene un archivo asociado',
      );
    }
    return media;
  }
}
