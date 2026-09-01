import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

/** GET /leads/:id/historial-estados — timeline de cambios de pipeline
 * (PLAN-PIPELINE-INMOBILIARIA.md §7/§8.2), mismo control de acceso que
 * gestionar el lead. */
@Injectable()
export class ObtenerHistorialLeadUseCase {
  constructor(
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const lead = await this.leads.buscarParaGestion(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    const esDueno = lead.asignadoUsuarioId === ctx.usuarioId;
    if (!esAdmin && !esDueno) {
      throw new ForbiddenException('No tienes acceso a este lead');
    }

    return this.leads.listarHistorial(organizacionId, leadId);
  }
}
