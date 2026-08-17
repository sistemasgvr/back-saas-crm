export const ANUNCIOS_REPOSITORY = Symbol('ANUNCIOS_REPOSITORY');

export interface AnuncioFiltro {
  id: string;
  conjuntoAnuncioId: string;
  nombre: string;
  estadoMeta: string | null;
}

export interface AnunciosRepository {
  listarPorOrganizacion(organizacionId: string, conjuntoAnuncioId?: string): Promise<AnuncioFiltro[]>;
}
