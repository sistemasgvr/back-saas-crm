export const META_INSIGHTS_REPOSITORY = Symbol('META_INSIGHTS_REPOSITORY');

export interface UpsertInsightDiarioInput {
  organizacionId: string;
  metaCuentaPublicitariaId: string;
  /** undefined = snapshot a nivel cuenta; string = snapshot a nivel campaña. */
  campanaId?: string;
  fecha: Date;
  spend: number;
  impressions: number;
  clicks: number;
  ctr?: number;
  cpc?: number;
  reach?: number;
  moneda?: string;
  datosCrudos?: unknown;
  usuarioEdicion: string;
}

export interface FiltroInsightsDiarios {
  metaCuentaId?: string;
  /** undefined = agregado a nivel cuenta (evita doble conteo con filas de campaña); string = solo esa campaña. */
  campanaId?: string;
  desde?: Date;
  hasta?: Date;
}

export interface ResumenSpend {
  spend: number;
  impressions: number;
  clicks: number;
  moneda: string | null;
}

export interface PuntoSpendDia {
  fecha: string;
  spend: number;
}

export interface SerieSpendCuenta {
  id: string;
  nombre: string;
  porDia: PuntoSpendDia[];
}

export interface MetaInsightsRepository {
  /** Crea o reemplaza el snapshot del día — reintentar un sync nunca duplica filas. */
  upsertDiario(input: UpsertInsightDiarioInput): Promise<void>;
  sumarSpend(
    organizacionId: string,
    filtro: FiltroInsightsDiarios,
  ): Promise<ResumenSpend>;
  serieDiariaSpend(
    organizacionId: string,
    filtro: FiltroInsightsDiarios,
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<PuntoSpendDia[]>;
  /** Una serie por cuenta publicitaria (solo filas a nivel cuenta: campanaId null). */
  serieDiariaSpendPorCuenta(
    organizacionId: string,
    filtro: Omit<FiltroInsightsDiarios, 'metaCuentaId' | 'campanaId'>,
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<SerieSpendCuenta[]>;
}
