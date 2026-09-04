export const DASHBOARD_REPOSITORY = Symbol('DASHBOARD_REPOSITORY');

export interface FiltroDashboard {
  campanaId?: string;
  conjuntoAnuncioId?: string;
  anuncioId?: string;
  metaCuentaId?: string;
  /** Filtra leads por inmueble de interés (`leads.inmueble_interes_id`). */
  inmuebleId?: string;
  tipoLead?: string;
  /** Filtro de asignación ya resuelto (rol-aware en el use-case). */
  asignacion?: FiltroAsignacionDashboard;
}

export type FiltroAsignacionDashboard =
  | { modo: 'todos' }
  | { modo: 'sin_asignar' }
  | { modo: 'usuario'; usuarioId: string }
  | { modo: 'mios_y_pool'; usuarioId: string };

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

export interface DashboardKpis {
  total: number;
  hoy: number;
  semana: number;
  mes: number;
}

export interface PuntoSerieDia {
  fecha: string;
  total: number;
}

export interface PuntoSerieNombrado {
  id: string;
  nombre: string;
  total: number;
}

export interface DashboardSeries {
  porDia: PuntoSerieDia[];
  porCampana: PuntoSerieNombrado[];
  porAnuncio: PuntoSerieNombrado[];
  /** Top inmuebles por leads interesados en el rango (máx. 10). */
  porInmueble: PuntoSerieNombrado[];
}

export interface ConteoEstadoGestion {
  estadoGestion: string;
  total: number;
}

export interface TiempoPromedioEstado {
  estadoGestion: string;
  /** Promedio en horas; null si no hay muestras. */
  horasPromedio: number | null;
  muestras: number;
}

export interface EmbudoKpisPorTipo {
  tipoLead: string | null;
  total: number;
  contactados: number;
  cerradosGanados: number;
  porEstado: ConteoEstadoGestion[];
}

export interface EmbudoKpisRaw {
  total: number;
  contactados: number;
  cerradosGanados: number;
  porEstado: ConteoEstadoGestion[];
  tiempoPromedioPorEstado: TiempoPromedioEstado[];
  porTipoLead: EmbudoKpisPorTipo[];
}

export interface DashboardRepository {
  contarLeads(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango?: RangoFechas,
  ): Promise<number>;
  serieDiaria(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<PuntoSerieDia[]>;
  serieCampanas(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
  ): Promise<PuntoSerieNombrado[]>;
  serieAnuncios(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
  ): Promise<PuntoSerieNombrado[]>;
  serieInmuebles(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
    limite?: number,
  ): Promise<PuntoSerieNombrado[]>;
  embudoKpis(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
  ): Promise<EmbudoKpisRaw>;
}
