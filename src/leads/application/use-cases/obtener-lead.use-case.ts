import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LEADS_LECTURA_REPOSITORY } from '../ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../ports/leads-lectura.repository.port';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { tienePermiso } from '../../../shared/domain/permisos';

@Injectable()
export class ObtenerLeadUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    ctx: {
      usuarioId: string;
      rol: RolOrganizacion;
      permisos?: readonly string[];
    },
  ) {
    const lead = await this.leads.obtenerPorId(organizacionId, id);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    // USUARIO solo ve el detalle si es suyo o está libre en el pool — no el
    // historial de leads asignados a otros (PLAN-GESTION-LEADS-WHATSAPP.md §3).
    const esAdmin = tienePermiso(ctx, 'leads.ver_todos');
    const esVisible =
      esAdmin || lead.asignado === null || lead.asignado.id === ctx.usuarioId;
    if (!esVisible) {
      throw new ForbiddenException('No tienes acceso a este lead');
    }

    return lead;
  }
}
