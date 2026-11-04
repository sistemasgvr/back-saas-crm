import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type {
  FiltroVisibilidadChats,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
import { veTodosLosChats } from '../../domain/acceso-conversacion-whatsapp';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';

/** Badge de no leídos del sidebar: misma regla que la lista por defecto
 * (todos los chats de la org, incluidos libres / sin lead). */
@Injectable()
export class ContarNoLeidosWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  execute(
    organizacionId: string,
    ctx: {
      usuarioId: string;
      rol: RolOrganizacion;
      permisos?: readonly string[];
    },
  ): Promise<number> {
    const filtro: FiltroVisibilidadChats = veTodosLosChats(ctx)
      ? { modo: 'todos' }
      : { modo: 'usuario_y_libres', usuarioId: ctx.usuarioId };
    return this.conversaciones.contarNoLeidos(organizacionId, filtro);
  }
}
