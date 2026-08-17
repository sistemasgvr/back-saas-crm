export const LEADS_LECTURA_REPOSITORY = Symbol('LEADS_LECTURA_REPOSITORY');

export interface FiltroLeads {
  q?: string;
  campanaId?: string;
  anuncioId?: string;
  formularioId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
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
}

export interface LeadDetalle extends LeadResumen {
  conjuntoAnuncio: ReferenciaNombrada | null;
  formularioId: string | null;
  idExterno: string;
  datosCrudos: unknown;
  fechaCreacion: Date;
}

export interface ListaLeadsResultado {
  data: LeadResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadsLecturaRepository {
  listar(organizacionId: string, filtro: FiltroLeads): Promise<ListaLeadsResultado>;
  obtenerPorId(organizacionId: string, id: string): Promise<LeadDetalle | null>;
}
