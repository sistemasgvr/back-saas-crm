import { Inject, Injectable } from '@nestjs/common';
import { LEADS_LECTURA_REPOSITORY } from '../ports/leads-lectura.repository.port';
import type {
  FiltroAsignacion,
  LeadsLecturaRepository,
} from '../ports/leads-lectura.repository.port';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import {
  inicioDiaLimaUtc,
  finDiaLimaUtc,
} from '../../../shared/application/lima-time';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

export interface ListarLeadsInput {
  q?: string;
  campanaId?: string;
  anuncioId?: string;
  metaPaginaId?: string;
  metaCuentaId?: string;
  formularioId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  /** "mios" | "sin_asignar" | un usuarioId puntual (solo admin puede ver el de otro). */
  asignado?: string;
  tipoLead?: string;
  estadoGestion?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class ListarLeadsUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
  ) {}

  /** Nunca confía en lo que pida el cliente para decidir visibilidad — un
   * USUARIO no puede pedir los leads de otro usuario aunque lo intente en el
   * query param (PLAN-GESTION-LEADS-WHATSAPP.md §3). */
  private resolverAsignacion(
    input: ListarLeadsInput,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): FiltroAsignacion {
    const esAdmin = ROLES_ADMIN.includes(ctx.rol);

    if (input.asignado === 'sin_asignar') {
      return { modo: 'sin_asignar' };
    }
    if (input.asignado === 'mios') {
      return { modo: 'mios_y_pool', usuarioId: ctx.usuarioId };
    }
    if (input.asignado) {
      if (esAdmin || input.asignado === ctx.usuarioId) {
        return { modo: 'usuario', usuarioId: input.asignado };
      }
      // USUARIO pidiendo ver leads de otro: se ignora, cae a su vista por defecto.
    }
    return esAdmin
      ? { modo: 'todos' }
      : { modo: 'mios_y_pool', usuarioId: ctx.usuarioId };
  }

  execute(
    organizacionId: string,
    input: ListarLeadsInput,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    return this.leads.listar(organizacionId, {
      q: input.q,
      campanaId: input.campanaId,
      anuncioId: input.anuncioId,
      metaPaginaId: input.metaPaginaId,
      metaCuentaId: input.metaCuentaId,
      formularioId: input.formularioId,
      fechaDesde: input.fechaDesde
        ? inicioDiaLimaUtc(input.fechaDesde)
        : undefined,
      fechaHasta: input.fechaHasta
        ? finDiaLimaUtc(input.fechaHasta)
        : undefined,
      asignacion: this.resolverAsignacion(input, ctx),
      tipoLead: input.tipoLead,
      estadoGestion: input.estadoGestion,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
