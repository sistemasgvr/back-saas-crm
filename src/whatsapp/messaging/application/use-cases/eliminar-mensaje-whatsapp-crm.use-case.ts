import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

/**
 * Soft-delete en el CRM. La Cloud API de Meta no expone "borrar para todos"
 * (solo llegan webhooks de revoke si el contacto o la app Business lo borran).
 * Aquí marcamos el mensaje como eliminado en nuestra BD.
 */
@Injectable()
export class EliminarMensajeWhatsAppCrmUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    conversacionId: string,
    mensajeId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    const esDueno = conversacion.lead?.asignadoUsuarioId === ctx.usuarioId;
    if (!esAdmin && !esDueno) {
      throw new ForbiddenException(
        'Solo el dueño del lead o un administrador puede eliminar mensajes',
      );
    }

    const mensaje = await this.conversaciones.buscarMensajePorId(
      organizacionId,
      mensajeId,
    );
    if (!mensaje || mensaje.whatsappConversacionId !== conversacionId) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    const ok = await this.conversaciones.marcarMensajeEliminadoEnCrm(
      organizacionId,
      mensajeId,
    );
    if (!ok) {
      throw new NotFoundException('Mensaje no encontrado');
    }
  }
}
