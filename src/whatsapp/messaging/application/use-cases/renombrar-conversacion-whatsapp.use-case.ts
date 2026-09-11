import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import { puedeEscribirConversacionWhatsApp } from '../../domain/acceso-conversacion-whatsapp';

@Injectable()
export class RenombrarConversacionWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    conversacionId: string,
    nombre: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (!puedeEscribirConversacionWhatsApp(conversacion.lead, ctx)) {
      throw new ForbiddenException(
        'Solo el dueño del lead, un administrador o un chat libre pueden renombrar este contacto',
      );
    }

    const nombreTrim = nombre.trim();
    if (nombreTrim.length < 1) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }
    if (nombreTrim.length > 200) {
      throw new BadRequestException(
        'El nombre no puede superar los 200 caracteres',
      );
    }

    await this.conversaciones.renombrar(
      organizacionId,
      conversacionId,
      nombreTrim,
    );
  }
}
