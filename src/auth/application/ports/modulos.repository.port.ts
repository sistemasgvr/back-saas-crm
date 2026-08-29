export const MODULOS_REPOSITORY = Symbol('MODULOS_REPOSITORY');

export interface ModuloOrganizacion {
  codigo: string;
  habilitado: boolean;
}

export interface ModulosRepository {
  findModulosPorOrganizacion(
    organizacionId: string,
  ): Promise<ModuloOrganizacion[]>;
}
