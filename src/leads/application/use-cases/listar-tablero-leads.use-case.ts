import { Inject, Injectable } from '@nestjs/common';
import { LEADS_LECTURA_REPOSITORY } from '../ports/leads-lectura.repository.port';
import type {
  FiltroAsignacion,
  LeadsLecturaRepository,
  LeadTableroRow,
} from '../ports/leads-lectura.repository.port';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { TIPOS_LEAD_INMOBILIARIA } from '../../../shared/domain/tipos-lead-inmobiliaria';
import {
  estadosColumnasTablero,
  etiquetasColumnasTablero,
} from '../../../shared/domain/pipeline-inmobiliaria';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

export interface ColumnaTablero {
  codigo: string;
  etiqueta: string;
  leads: LeadTableroRow[];
}

/** GET /leads/pipeline/tablero — mismos datos que /leads pero agrupados por
 * columna de estado para el kanban (PLAN-PIPELINE-INMOBILIARIA.md §20.4).
 * "Mismo PATCH por debajo": mover una tarjeta llama al mismo
 * ActualizarGestionLeadUseCase que el selector de la vista de detalle, así
 * que la validación de transición es idéntica en ambas UI. */
@Injectable()
export class ListarTableroLeadsUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
  ) {}

  private resolverAsignacion(
    asignadoParam: string | undefined,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): FiltroAsignacion {
    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    if (asignadoParam === 'sin_asignar') return { modo: 'sin_asignar' };
    if (asignadoParam === 'mios')
      return { modo: 'mios_y_pool', usuarioId: ctx.usuarioId };
    if (asignadoParam) {
      if (esAdmin || asignadoParam === ctx.usuarioId) {
        return { modo: 'usuario', usuarioId: asignadoParam };
      }
    }
    return esAdmin
      ? { modo: 'todos' }
      : { modo: 'mios_y_pool', usuarioId: ctx.usuarioId };
  }

  async execute(
    organizacionId: string,
    tipoLeadParam: string | undefined,
    asignadoParam: string | undefined,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<{ columnas: ColumnaTablero[] }> {
    const tipoFiltro = TIPOS_LEAD_INMOBILIARIA.includes(
      tipoLeadParam as never,
    )
      ? (tipoLeadParam as string)
      : undefined;

    const filas = await this.leads.listarParaTablero(organizacionId, {
      tipoLead: tipoFiltro,
      asignacion: this.resolverAsignacion(asignadoParam, ctx),
    });

    const etiquetas = etiquetasColumnasTablero(tipoFiltro);
    const columnas = estadosColumnasTablero(tipoFiltro).map((codigo) => ({
      codigo,
      etiqueta: etiquetas[codigo] ?? codigo,
      leads: filas.filter((f) => f.estadoGestion === codigo),
    }));

    return { columnas };
  }
}
