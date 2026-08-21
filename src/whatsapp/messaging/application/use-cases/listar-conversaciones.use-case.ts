import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type {
  FiltroVisibilidadChats,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

/** Admin ve todos los chats de la org; USUARIO solo los de leads asignados a
 * él (PLAN-GESTION-LEADS-WHATSAPP.md §3 — tabla de visibilidad). */
@Injectable()
export class ListarConversacionesUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  execute(
    organizacionId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const filtro: FiltroVisibilidadChats = ROLES_ADMIN.includes(ctx.rol)
      ? { modo: 'todos' }
      : { modo: 'usuario', usuarioId: ctx.usuarioId };
    return this.conversaciones.listar(organizacionId, filtro);
  }
}
