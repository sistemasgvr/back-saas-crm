export const LEAD_VISITAS_REPOSITORY = Symbol('LEAD_VISITAS_REPOSITORY');

export interface VisitaAgendaRow {
  id: string;
  leadId: string;
  leadNombre: string | null;
  leadTelefono: string | null;
  programadaEn: Date;
  referenciaInmueble: string;
  modalidad: string;
  estado: string;
  asignado: { id: string; nombre: string } | null;
}

export interface VisitaLeadRow {
  id: string;
  programadaEn: Date;
  referenciaInmueble: string;
  modalidad: string;
  estado: string;
  resultado: string | null;
  nota: string | null;
  feedback: string | null;
  fechaCreacion: Date;
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
}
