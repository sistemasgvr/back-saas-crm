export const ORGANIZACION_MODULOS_ADMIN_REPOSITORY = Symbol(
  'ORGANIZACION_MODULOS_ADMIN_REPOSITORY',
);

export interface ModuloConHabilitado {
  id: string;
  codigo: string;
  nombre: string;
  icono: string | null;
  orden: number;
  habilitado: boolean;
}

export interface OrganizacionModulosAdminRepository {
  /** Matriz completa del catálogo activo con el habilitado de esta organización (false si aún no tiene fila). */
  listarMatrizPorOrganizacion(
    organizacionId: string,
  ): Promise<ModuloConHabilitado[]>;
  toggle(
    organizacionId: string,
    moduloId: string,
    habilitado: boolean,
    usuarioEdicion: string,
  ): Promise<void>;
}
