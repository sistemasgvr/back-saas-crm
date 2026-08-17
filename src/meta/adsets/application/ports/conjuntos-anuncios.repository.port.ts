export const CONJUNTOS_ANUNCIOS_REPOSITORY = Symbol('CONJUNTOS_ANUNCIOS_REPOSITORY');

export interface ConjuntoAnuncioFiltro {
  id: string;
  campanaId: string;
  nombre: string;
  estadoMeta: string | null;
}

export interface ConjuntosAnunciosRepository {
  listarPorOrganizacion(organizacionId: string, campanaId?: string): Promise<ConjuntoAnuncioFiltro[]>;
}
