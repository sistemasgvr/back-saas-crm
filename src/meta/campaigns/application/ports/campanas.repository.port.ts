export const CAMPANAS_REPOSITORY = Symbol('CAMPANAS_REPOSITORY');

export interface CampanaFiltro {
  id: string;
  nombre: string;
  estadoMeta: string | null;
}

export interface CampanasRepository {
  listarPorOrganizacion(organizacionId: string): Promise<CampanaFiltro[]>;
}
