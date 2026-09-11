import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type {
  FiltroVisibilidadChats,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
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
    _ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<number> {
    const filtro: FiltroVisibilidadChats = { modo: 'todos' };
    return this.conversaciones.contarNoLeidos(organizacionId, filtro);
  }
}
