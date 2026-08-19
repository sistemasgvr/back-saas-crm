export const DASHBOARD_REPOSITORY = Symbol('DASHBOARD_REPOSITORY');

export interface FiltroDashboard {
  campanaId?: string;
  conjuntoAnuncioId?: string;
  anuncioId?: string;
  metaCuentaId?: string;
}

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
}
