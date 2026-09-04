export const LEAD_VISITAS_REPOSITORY = Symbol('LEAD_VISITAS_REPOSITORY');

export interface InmuebleVisitaResumen {
  id: string;
  codigo: string;
  titulo: string;
}

export interface VisitaAgendaRow {
  id: string;
  leadId: string;
  leadNombre: string | null;
  leadTelefono: string | null;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string;
  inmuebleId: string | null;
  inmueble: InmuebleVisitaResumen | null;
  modalidad: string;
  estado: string;
  nota: string | null;
  asignado: { id: string; nombre: string } | null;
}

export interface VisitaLeadRow {
  id: string;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string;
  inmuebleId: string | null;
  inmueble: InmuebleVisitaResumen | null;
  modalidad: string;
  estado: string;
  resultado: string | null;
  nota: string | null;
  feedback: string | null;
  fechaCreacion: Date;
}

export interface VisitaDetalle {
  id: string;
  leadId: string;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string;
  modalidad: string;
  estado: string;
  resultado: string | null;
  nota: string | null;
  feedback: string | null;
  asignadoUsuarioId: string | null;
}

export interface CrearVisitaRepoInput {
  id: string;
  leadId: string;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string;
  inmuebleId?: string | null;
  modalidad: string;
  nota: string | null;
  asignadoUsuarioId: string | null;
  creadoPorUsuarioId: string;
}

export interface ActualizarVisitaRepoInput {
  programadaEn?: Date;
  programadaFin?: Date;
  duracionMinutos?: number;
  referenciaInmueble?: string;
  inmuebleId?: string | null;
  modalidad?: string;
  estado?: string;
  resultado?: string | null;
  nota?: string | null;
  feedback?: string | null;
}

export interface LeadVisitasRepository {
  listarAgenda(
    organizacionId: string,
    filtros: {
      desde: Date;
      hasta: Date;
      asignadoUsuarioId?: string;
    },
  ): Promise<VisitaAgendaRow[]>;

  listarPorLead(
    organizacionId: string,
    leadId: string,
  ): Promise<VisitaLeadRow[]>;

  obtenerPorId(
    organizacionId: string,
    visitaId: string,
  ): Promise<VisitaDetalle | null>;

  crear(
    organizacionId: string,
    input: CrearVisitaRepoInput,
  ): Promise<VisitaAgendaRow>;

  actualizar(
    organizacionId: string,
    visitaId: string,
    cambios: ActualizarVisitaRepoInput,
  ): Promise<VisitaAgendaRow>;

  cancelarProgramadasDelLead(
    organizacionId: string,
    leadId: string,
  ): Promise<void>;

  /** true si el asesor ya tiene una PROGRAMADA que solapa el intervalo. */
  existeSolape(
    organizacionId: string,
    asignadoUsuarioId: string,
    inicio: Date,
    fin: Date,
    excluirVisitaId?: string,
  ): Promise<boolean>;
}
