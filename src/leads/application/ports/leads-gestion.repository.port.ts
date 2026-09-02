export const LEADS_GESTION_REPOSITORY = Symbol('LEADS_GESTION_REPOSITORY');

export interface LeadParaGestion {
  id: string;
  asignadoUsuarioId: string | null;
  tipoLead: string | null;
  estadoGestion: string;
}

export interface CambiosGestionLead {
  tipoLead?: string;
  estadoGestion?: string;
  motivoCierre?: string | null;
  notaCierre?: string | null;
}

export interface RegistrarHistorialInput {
  /** Generado por el caller (no por Prisma) — así el use-case ya lo tiene a
   * mano para usarlo como event_id de deduplicación en Conversions API,
   * sin depender de lo que devuelva la transacción. */
  id: string;
  organizacionId: string;
  leadId: string;
  tipoLead: string | null;
  desde: string | null;
  hacia: string;
  motivoCierre?: string | null;
  nota?: string | null;
  metadata?: Record<string, string> | null;
  usuarioId?: string;
  crearVisita?: {
    id: string;
    programadaEn: Date;
    referenciaInmueble: string;
    modalidad: string;
    nota?: string | null;
    asignadoUsuarioId: string | null;
    creadoPorUsuarioId: string;
  };
  cerrarVisita?: {
    resultado: string;
    feedback?: string | null;
  };
  crearCalificacion?: {
    id: string;
    tipoLead: string | null;
    presupuesto?: string | null;
    zona?: string | null;
    tipoInmueble?: string | null;
    tipoPropiedad?: string | null;
    precioReferencia?: string | null;
    nota: string;
    usuarioId: string;
  };
  /** Al reiniciar el embudo por cambio de tipo — cancela citas abiertas. */
  cancelarVisitasProgramadas?: boolean;
}

export interface HistorialEstadoRow {
  id: string;
  tipoLead: string | null;
  desde: string | null;
  hacia: string;
  motivoCierre: string | null;
  nota: string | null;
  metadata: Record<string, string> | null;
  visita: {
    id: string;
    programadaEn: Date;
    referenciaInmueble: string;
    modalidad: string;
    estado: string;
    resultado: string | null;
  } | null;
  calificacion: {
    id: string;
    presupuesto: string | null;
    zona: string | null;
    tipoInmueble: string | null;
    tipoPropiedad: string | null;
    precioReferencia: string | null;
    nota: string;
  } | null;
  usuario: { id: string; nombre: string } | null;
  fechaCreacion: Date;
}

export interface LeadsGestionRepository {
  /** Lectura mínima para checks de ownership/transición antes de mutar. */
  buscarParaGestion(
    organizacionId: string,
    id: string,
  ): Promise<LeadParaGestion | null>;
  /** Update condicional WHERE asignado_usuario_id IS NULL — race-safe:
   * devuelve false si otro ya lo tomó primero (PLAN §9 riesgos). */
  tomar(
    organizacionId: string,
    id: string,
    usuarioId: string,
  ): Promise<boolean>;
  asignar(
    organizacionId: string,
    id: string,
    usuarioId: string,
    asignadoPorUsuarioId: string,
  ): Promise<void>;
  liberar(organizacionId: string, id: string): Promise<void>;
  /** Evita asignar a alguien fuera de la organización. */
  esMiembroActivo(organizacionId: string, usuarioId: string): Promise<boolean>;
  /** Actualiza tipoLead/estadoGestion/motivoCierre/notaCierre y, si
   * `historial` viene dado, inserta la fila de auditoría en la misma
   * transacción (PLAN-PIPELINE-INMOBILIARIA.md §5.2/§9). */
  actualizarGestion(
    organizacionId: string,
    id: string,
    cambios: CambiosGestionLead,
    usuarioEdicion: string,
    historial?: RegistrarHistorialInput,
  ): Promise<void>;
  listarHistorial(
    organizacionId: string,
    leadId: string,
  ): Promise<HistorialEstadoRow[]>;
  /** leadgen_id de Meta (Lead.idExterno) — lo pide Conversions API como
   * user_data.lead_id para Conversion Leads. Null si el lead no existe. */
  obtenerIdExternoMeta(
    organizacionId: string,
    leadId: string,
  ): Promise<string | null>;
}
