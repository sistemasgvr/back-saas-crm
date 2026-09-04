import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '../ports/dashboard.repository.port';
import type {
  DashboardRepository,
  FiltroAsignacionDashboard,
  FiltroDashboard,
} from '../ports/dashboard.repository.port';
import type {
  RequestContext,
  RolOrganizacion,
} from '../../../auth/domain/request-context.interface';
import {
  estadosColumnasTablero,
  etiquetasColumnasTablero,
  parsePipelineConfig,
} from '../../../shared/domain/pipeline-inmobiliaria';
import {
  finDiaLimaUtc,
  finMesLima,
  hoyLima,
  inicioDiaLimaUtc,
  inicioMesLima,
} from '../../../shared/application/lima-time';
import { ORGANIZACIONES_REPOSITORY } from '../../../organizations/application/ports/organizaciones.repository.port';
import type { OrganizacionesRepository } from '../../../organizations/application/ports/organizaciones.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

export interface ObtenerEmbudoKpisInput extends FiltroDashboard {
  fechaDesde?: string;
  fechaHasta?: string;
  asignado?: string;
}

export interface PuntoEmbudoEstado {
  estadoGestion: string;
  etiqueta: string;
  total: number;
  horasPromedio: number | null;
}

export interface EmbudoKpisPorTipoRespuesta {
  tipoLead: string | null;
  etiquetaTipo: string;
  total: number;
  tasaContacto: number | null;
  conversionGanado: number | null;
  porEstado: { estadoGestion: string; etiqueta: string; total: number }[];
}

export interface EmbudoKpisRespuesta {
  total: number;
  contactados: number;
  cerradosGanados: number;
  /** Ratio 0–1; null si no hay leads en el periodo. */
  tasaContacto: number | null;
  /** CERRADO_GANADO / total; null si no hay leads. */
  conversionGanado: number | null;
  porEstado: PuntoEmbudoEstado[];
  porTipoLead: EmbudoKpisPorTipoRespuesta[];
}

const ETIQUETA_TIPO: Record<string, string> = {
  COMPRA: 'Compra',
  VENTA: 'Venta',
  OTRO: 'Otro',
};

@Injectable()
export class ObtenerEmbudoKpisUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboard: DashboardRepository,
    @Inject(ORGANIZACIONES_REPOSITORY)
    private readonly organizaciones: OrganizacionesRepository,
  ) {}

  private resolverAsignacion(
    asignado: string | undefined,
    ctx: RequestContext,
  ): FiltroAsignacionDashboard {
    if (!asignado) return { modo: 'todos' };

    const rol = ctx.rol;
    const esAdmin = rol ? ROLES_ADMIN.includes(rol) : false;

    if (asignado === 'sin_asignar') return { modo: 'sin_asignar' };
    if (asignado === 'mios') {
      return { modo: 'mios_y_pool', usuarioId: ctx.usuarioId };
    }
    if (esAdmin || asignado === ctx.usuarioId) {
      return { modo: 'usuario', usuarioId: asignado };
    }
    // USUARIO pidiendo ver a otro: se limita a su propia vista.
    return { modo: 'mios_y_pool', usuarioId: ctx.usuarioId };
  }

  private ratio(numerador: number, denominador: number): number | null {
    if (denominador <= 0) return null;
    return Math.round((numerador / denominador) * 1000) / 1000;
  }

  async execute(
    ctx: RequestContext,
    input: ObtenerEmbudoKpisInput,
  ): Promise<EmbudoKpisRespuesta> {
    const hoy = hoyLima();
    const fechaDesde = input.fechaDesde ?? inicioMesLima(hoy);
    const fechaHasta = input.fechaHasta ?? finMesLima(hoy);
    const rango = {
      desde: inicioDiaLimaUtc(fechaDesde),
      hasta: finDiaLimaUtc(fechaHasta),
    };

    const filtro: FiltroDashboard = {
      campanaId: input.campanaId,
      conjuntoAnuncioId: input.conjuntoAnuncioId,
      anuncioId: input.anuncioId,
      metaCuentaId: input.metaCuentaId,
      inmuebleId: input.inmuebleId,
      tipoLead: input.tipoLead,
      asignacion: this.resolverAsignacion(input.asignado, ctx),
    };

    const raw = await this.dashboard.embudoKpis(
      ctx.organizacionId!,
      filtro,
      rango,
    );

    const override = parsePipelineConfig(
      await this.organizaciones.obtenerPipelineConfig(ctx.organizacionId!),
    );

    const columnas = estadosColumnasTablero(input.tipoLead, override);
    const etiquetas = etiquetasColumnasTablero(input.tipoLead, override);
    const columnasSet = new Set<string>(columnas);
    const tiempoPorEstado = new Map(
      raw.tiempoPromedioPorEstado.map((t) => [
        t.estadoGestion,
        t.horasPromedio,
      ]),
    );
    const conteoPorEstado = new Map(
      raw.porEstado.map((p) => [p.estadoGestion, p.total]),
    );

    const porEstado: PuntoEmbudoEstado[] = columnas.map((estadoGestion) => ({
      estadoGestion,
      etiqueta: etiquetas[estadoGestion] ?? estadoGestion,
      total: conteoPorEstado.get(estadoGestion) ?? 0,
      horasPromedio: tiempoPorEstado.get(estadoGestion) ?? null,
    }));

    // Estados no previstos en el catálogo (datos legacy) — se anexan al final.
    for (const [estadoGestion, total] of conteoPorEstado) {
      if (columnasSet.has(estadoGestion)) continue;
      porEstado.push({
        estadoGestion,
        etiqueta: estadoGestion,
        total,
        horasPromedio: tiempoPorEstado.get(estadoGestion) ?? null,
      });
    }

    const porTipoLead = raw.porTipoLead.map((t) => {
      const etiqTipo = t.tipoLead
        ? (ETIQUETA_TIPO[t.tipoLead] ?? t.tipoLead)
        : 'Sin clasificar';
      const colsTipo = estadosColumnasTablero(t.tipoLead ?? undefined, override);
      const etiqEstados = etiquetasColumnasTablero(
        t.tipoLead ?? undefined,
        override,
      );
      const mapEstado = new Map(
        t.porEstado.map((p) => [p.estadoGestion, p.total]),
      );
      return {
        tipoLead: t.tipoLead,
        etiquetaTipo: etiqTipo,
        total: t.total,
        tasaContacto: this.ratio(t.contactados, t.total),
        conversionGanado: this.ratio(t.cerradosGanados, t.total),
        porEstado: colsTipo.map((estadoGestion) => ({
          estadoGestion,
          etiqueta: etiqEstados[estadoGestion] ?? estadoGestion,
          total: mapEstado.get(estadoGestion) ?? 0,
        })),
      };
    });

    return {
      total: raw.total,
      contactados: raw.contactados,
      cerradosGanados: raw.cerradosGanados,
      tasaContacto: this.ratio(raw.contactados, raw.total),
      conversionGanado: this.ratio(raw.cerradosGanados, raw.total),
      porEstado,
      porTipoLead,
    };
  }
}
