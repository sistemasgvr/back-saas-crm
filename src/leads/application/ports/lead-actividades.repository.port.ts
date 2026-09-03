export const LEAD_ACTIVIDADES_REPOSITORY = Symbol('LEAD_ACTIVIDADES_REPOSITORY');

export interface ActividadAgendaRow {
  id: string;
  leadId: string;
  leadNombre: string | null;
  leadTelefono: string | null;
  tipo: string;
  titulo: string;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string | null;
  modalidad: string | null;
  estado: string;
  nota: string | null;
  asignado: { id: string; nombre: string } | null;
}

export interface ActividadDetalle {
  id: string;
  leadId: string;
  tipo: string;
  titulo: string;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string | null;
  modalidad: string | null;
  estado: string;
  nota: string | null;
  asignadoUsuarioId: string | null;
}

export interface CrearActividadRepoInput {
  id: string;
  leadId: string;
  tipo: string;
  titulo: string;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string | null;
  modalidad: string | null;
  nota: string | null;
  asignadoUsuarioId: string | null;
  creadoPorUsuarioId: string;
}

export interface ActualizarActividadRepoInput {
  tipo?: string;
  titulo?: string;
  programadaEn?: Date;
  programadaFin?: Date;
  duracionMinutos?: number;
  referenciaInmueble?: string | null;
  modalidad?: string | null;
  estado?: string;
  nota?: string | null;
}

export interface LeadActividadesRepository {
  listarAgenda(
    organizacionId: string,
    filtros: {
      desde: Date;
      hasta: Date;
      asignadoUsuarioId?: string;
    },
  ): Promise<ActividadAgendaRow[]>;

  obtenerPorId(
    organizacionId: string,
    actividadId: string,
  ): Promise<ActividadDetalle | null>;

  crear(
    organizacionId: string,
    input: CrearActividadRepoInput,
  ): Promise<ActividadAgendaRow>;

  actualizar(
    organizacionId: string,
    actividadId: string,
    cambios: ActualizarActividadRepoInput,
  ): Promise<ActividadAgendaRow>;

  existeSolape(
    organizacionId: string,
    asignadoUsuarioId: string,
    inicio: Date,
    fin: Date,
    excluirActividadId?: string,
  ): Promise<boolean>;
}
