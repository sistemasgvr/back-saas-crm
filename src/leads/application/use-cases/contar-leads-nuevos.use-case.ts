import { Inject, Injectable } from '@nestjs/common';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { LEADS_LECTURA_REPOSITORY } from '../ports/leads-lectura.repository.port';
import type {
  FiltroAsignacion,
  LeadsLecturaRepository,
} from '../ports/leads-lectura.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

@Injectable()
export class ContarLeadsNuevosUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
  ) {}

  private resolverAsignacion(
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): FiltroAsignacion {
    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    return esAdmin
      ? { modo: 'todos' }
      : { modo: 'mios_y_pool', usuarioId: ctx.usuarioId };
  }

  async execute(
    organizacionId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<{ count: number }> {
    const count = await this.leads.contarNuevos(
      organizacionId,
      this.resolverAsignacion(ctx),
    );
    return { count };
  }
}
