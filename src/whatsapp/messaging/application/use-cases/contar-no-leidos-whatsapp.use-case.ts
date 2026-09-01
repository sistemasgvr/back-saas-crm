import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type {
  FiltroVisibilidadChats,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

/** GET /whatsapp/chats/unread-count — total de mensajes sin leer entre las
 * conversaciones que el usuario puede ver, para el badge del ítem "Chats"
 * en el sidebar (mismo criterio de visibilidad que ListarConversacionesUseCase). */
@Injectable()
export class ContarNoLeidosWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  execute(
    organizacionId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<number> {
    const filtro: FiltroVisibilidadChats = ROLES_ADMIN.includes(ctx.rol)
      ? { modo: 'todos' }
      : { modo: 'usuario', usuarioId: ctx.usuarioId };
    return this.conversaciones.contarNoLeidos(organizacionId, filtro);
  }
}
