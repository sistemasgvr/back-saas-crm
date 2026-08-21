import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';
import { TIPOS_LEAD_INMOBILIARIA } from '../../../shared/domain/tipos-lead-inmobiliaria';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

/** PATCH /leads/:id/gestion — "Dueño o admin", sin estado de gestión en G2
 * (eso queda para G5). */
@Injectable()
export class ActualizarTipoLeadUseCase {
  constructor(
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    tipoLead: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    if (!TIPOS_LEAD_INMOBILIARIA.includes(tipoLead as never)) {
      throw new BadRequestException(
        `tipoLead debe ser uno de: ${TIPOS_LEAD_INMOBILIARIA.join(', ')}`,
      );
    }

    const lead = await this.leads.buscarParaGestion(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    const esDueno = lead.asignadoUsuarioId === ctx.usuarioId;
    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    if (!esDueno && !esAdmin) {
      throw new ForbiddenException(
        'Solo el dueño del lead o un administrador puede editar el tipo',
      );
    }

    await this.leads.actualizarTipo(
      organizacionId,
      leadId,
      tipoLead,
      ctx.usuarioId,
    );
  }
}
