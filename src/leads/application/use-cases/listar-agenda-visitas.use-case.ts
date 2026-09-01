import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';

@Injectable()
export class ListarAgendaVisitasUseCase {
  constructor(
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
  ) {}

  execute(
    organizacionId: string,
    query: { desde: string; hasta: string; asignado?: string },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const desde = new Date(query.desde);
    const hasta = new Date(query.hasta);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      throw new BadRequestException('Rango de fechas inválido');
    }

    let asignadoUsuarioId: string | undefined;
    if (query.asignado === 'mios') {
      asignadoUsuarioId = ctx.usuarioId;
    } else if (
      query.asignado &&
      query.asignado !== 'sin_asignar' &&
      ['PROPIETARIO', 'ADMINISTRADOR'].includes(ctx.rol)
    ) {
      asignadoUsuarioId = query.asignado;
    } else if (
      !query.asignado &&
      ctx.rol === 'USUARIO'
    ) {
      asignadoUsuarioId = ctx.usuarioId;
    }

    return this.visitas.listarAgenda(organizacionId, {
      desde,
      hasta,
      asignadoUsuarioId,
    });
  }
}
