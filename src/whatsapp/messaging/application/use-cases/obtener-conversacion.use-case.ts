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
const LIMITE_MENSAJES = 200;

/** Trae la conversación + su historial y la marca leída (abrirla = leerla,
 * mismo patrón simple que el resto del inbox v1). */
@Injectable()
export class ObtenerConversacionUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      id,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    const esDueno = conversacion.lead?.asignadoUsuarioId === ctx.usuarioId;
    if (!esAdmin && !esDueno) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    const mensajes = await this.conversaciones.listarMensajes(
      id,
      LIMITE_MENSAJES,
    );
    if (conversacion.noLeidos > 0) {
      await this.conversaciones.marcarLeida(id);
    }

    return { ...conversacion, noLeidos: 0, mensajes };
  }
}
