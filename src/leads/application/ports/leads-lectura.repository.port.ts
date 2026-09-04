export const LEADS_LECTURA_REPOSITORY = Symbol('LEADS_LECTURA_REPOSITORY');

/** Decide qué leads puede ver quien consulta — se resuelve en el use-case a
 * partir del rol (nunca confiar en lo que mande el cliente), la repo solo
 * traduce esto a un where mecánico (PLAN-GESTION-LEADS-WHATSAPP.md §3). */
export type FiltroAsignacion =
  | { modo: 'todos' }
  | { modo: 'mios_y_pool'; usuarioId: string }
  | { modo: 'usuario'; usuarioId: string }
  | { modo: 'sin_asignar' };

export interface FiltroLeads {
  q?: string;
  campanaId?: string;
  anuncioId?: string;
  metaPaginaId?: string;
  metaCuentaId?: string;
  formularioId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  asignacion: FiltroAsignacion;
  tipoLead?: string;
  /** Código exacto (ej. "NEGOCIACION") o "ABIERTOS" (no terminales) / "CERRADOS" (terminales) — §8.1. */
  estadoGestion?: string;
  page: number;
  pageSize: number;
}

export interface ReferenciaNombrada {
  id: string;
  nombre: string;
}

export interface LeadResumen {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  fechaLead: Date | null;
  campana: ReferenciaNombrada | null;
  anuncio: ReferenciaNombrada | null;
  tipoLead: string | null;
  asignado: ReferenciaNombrada | null;
  estadoGestion: string;
}

export interface LeadDetalle extends LeadResumen {
  conjuntoAnuncio: ReferenciaNombrada | null;
  formularioId: string | null;
  idExterno: string;
  datosCrudos: unknown;
  fechaCreacion: Date;
  estadoGestionEn: Date | null;
  motivoCierre: string | null;
  notaCierre: string | null;
  /** Próxima visita o actividad PROGRAMADA (la más cercana por fecha). */
  proximaAccion: ProximaAccionLead | null;
}

/** Ítem unificado para el bloque “Próxima acción” en ficha lead. */
export interface ProximaAccionLead {
  origen: 'visita' | 'actividad';
  id: string;
  /** VISITA (pipeline) o tipo de LeadActividad (LLAMADA, REUNION, …). */
  tipo: string;
  titulo: string;
  programadaEn: Date;
  programadaFin: Date;
}

/** Fila liviana para una tarjeta de tablero kanban — no trae todo lo que
 * trae LeadResumen porque una tarjeta muestra mucho menos que una fila de
 * tabla. */
export interface LeadTableroRow {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  tipoLead: string | null;
  asignado: ReferenciaNombrada | null;
  estadoGestion: string;
  fechaLead: Date | null;
}

export interface ListaLeadsResultado {
  data: LeadResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadsLecturaRepository {
  listar(
    organizacionId: string,
    filtro: FiltroLeads,
  ): Promise<ListaLeadsResultado>;
  obtenerPorId(organizacionId: string, id: string): Promise<LeadDetalle | null>;
  /** Miembros activos de la org para el selector de "Asignar" — PLAN §5 G2. */
  listarMiembrosAsignables(
    organizacionId: string,
  ): Promise<ReferenciaNombrada[]>;
  /** Todos los leads del tipo pedido (tope 300, más recientes primero) para
   * armar el tablero kanban — sin paginar, el front agrupa por columna.
   * `tipoLead` omitido = todos los tipos; `OTRO` incluye sin clasificar. */
  listarParaTablero(
    organizacionId: string,
    filtro: { tipoLead?: string; asignacion: FiltroAsignacion },
  ): Promise<LeadTableroRow[]>;
  /** Leads en estado NUEVO visibles para el usuario (misma regla de asignación). */
  contarNuevos(
    organizacionId: string,
    asignacion: FiltroAsignacion,
  ): Promise<number>;
}
