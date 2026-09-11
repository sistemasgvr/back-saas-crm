import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type {
  FiltroVisibilidadChats,
  WhatsappConversacionesRepository,
} from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';

/** Todos los roles pueden ver todos los chats (incl. sin lead / sin asignar)
 * para poder tomarlos; `asignado=mios` acota a los del usuario. */
@Injectable()
export class ListarConversacionesUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  execute(
    organizacionId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
    query?: { asignado?: string },
  ) {
    const filtro: FiltroVisibilidadChats =
      query?.asignado === 'mios'
        ? { modo: 'usuario', usuarioId: ctx.usuarioId }
        : { modo: 'todos' };

    return this.conversaciones.listar(organizacionId, filtro);
  }
}
