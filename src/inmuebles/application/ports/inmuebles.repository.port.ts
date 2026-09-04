export const INMUEBLES_REPOSITORY = Symbol('INMUEBLES_REPOSITORY');

export type TipoInmueble =
  | 'DEPARTAMENTO'
  | 'CASA'
  | 'TERRENO'
  | 'LOCAL'
  | 'OFICINA'
  | 'OTRO';

export type OperacionInmueble = 'VENTA' | 'ALQUILER';

export type EstadoInmuebleCatalogo =
  | 'DISPONIBLE'
  | 'RESERVADO'
  | 'VENDIDO'
  | 'INACTIVO';

export interface InmuebleRow {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  operacion: string;
  zona: string | null;
  direccion: string | null;
  precio: number | null;
  moneda: string;
  estadoInmueble: string;
  notas: string | null;
  fechaCreacion: Date;
  fechaModificacion: Date;
}

export interface InmuebleFiltroOption {
  id: string;
  codigo: string;
  titulo: string;
  operacion: string;
  estadoInmueble: string;
  zona: string | null;
}

export interface FiltroInmuebles {
  page: number;
  pageSize: number;
  q?: string;
  tipo?: string;
  operacion?: string;
  estadoInmueble?: string;
  zona?: string;
}

export interface CrearInmuebleInput {
  codigo: string;
  titulo: string;
  tipo: string;
  operacion: string;
  zona?: string | null;
  direccion?: string | null;
  precio?: number | null;
  moneda?: string;
  estadoInmueble?: string;
  notas?: string | null;
  usuarioId: string;
}

export interface ActualizarInmuebleInput {
  codigo?: string;
  titulo?: string;
  tipo?: string;
  operacion?: string;
  zona?: string | null;
  direccion?: string | null;
  precio?: number | null;
  moneda?: string;
  estadoInmueble?: string;
  notas?: string | null;
  usuarioId: string;
}

export interface ListaInmueblesResultado {
  data: InmuebleRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Lead candidato a ranking de interesados de un inmueble. */
export interface LeadCandidatoInteres {
  id: string;
  nombre: string | null;
  telefono: string | null;
  estadoGestion: string;
  tipoLead: string | null;
  estadoGestionEn: Date | null;
  interesExplicito: boolean;
  visitas: {
    estado: string;
    programadaEn: Date;
    fechaModificacion: Date;
  }[];
}

export interface InmueblesRepository {
  listar(
    organizacionId: string,
    filtro: FiltroInmuebles,
  ): Promise<ListaInmueblesResultado>;

  listarFiltro(organizacionId: string): Promise<InmuebleFiltroOption[]>;

  obtenerPorId(
    organizacionId: string,
    id: string,
  ): Promise<InmuebleRow | null>;

  /**
   * Leads con interés explícito en el inmueble y/o visitas a ese inmueble.
   */
  listarCandidatosInteres(
    organizacionId: string,
    inmuebleId: string,
  ): Promise<LeadCandidatoInteres[]>;

  existeCodigo(
    organizacionId: string,
    codigo: string,
    excluirId?: string,
  ): Promise<boolean>;

  crear(
    organizacionId: string,
    input: CrearInmuebleInput,
  ): Promise<InmuebleRow>;

  actualizar(
    organizacionId: string,
    id: string,
    input: ActualizarInmuebleInput,
  ): Promise<InmuebleRow | null>;

  softDelete(
    organizacionId: string,
    id: string,
    usuarioId: string,
  ): Promise<boolean>;
}
