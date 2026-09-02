import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';
import { MarcarLeidoWhatsAppUseCase } from './marcar-leido-whatsapp.use-case';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];
const LIMITE_MENSAJES = 200;

/** Trae la conversación + su historial y la marca leída (abrirla = leerla,
 * mismo patrón simple que el resto del inbox v1) — tanto nuestro contador
 * interno como el check azul real en el WhatsApp del contacto. */
@Injectable()
export class ObtenerConversacionUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    private readonly marcarLeidoWhatsApp: MarcarLeidoWhatsAppUseCase,
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
      // Efecto secundario de UX (checks azules en el WhatsApp real del
      // contacto) — nunca debe tumbar la carga de la conversación si Meta
      // falla (token vencido, rate limit, etc.).
      await this.marcarLeidoWhatsApp
        .execute(organizacionId, id)
        .catch(() => undefined);
    }

    return { ...conversacion, noLeidos: 0, mensajes };
  }
}
