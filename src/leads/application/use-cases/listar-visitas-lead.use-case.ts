import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { LEADS_LECTURA_REPOSITORY } from '../ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../ports/leads-lectura.repository.port';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

@Injectable()
export class ListarVisitasLeadUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const lead = await this.leads.obtenerPorId(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    const esDueno = lead.asignado?.id === ctx.usuarioId;
    if (!esAdmin && !esDueno) {
      throw new ForbiddenException('No puedes ver las visitas de este lead');
    }

    return this.visitas.listarPorLead(organizacionId, leadId);
  }
}
