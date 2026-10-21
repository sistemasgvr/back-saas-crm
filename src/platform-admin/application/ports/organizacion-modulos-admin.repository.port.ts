export const ORGANIZACION_MODULOS_ADMIN_REPOSITORY = Symbol(
  'ORGANIZACION_MODULOS_ADMIN_REPOSITORY',
);

export interface ModuloConHabilitado {
  requiere: string[];
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  orden: number;
  habilitado: boolean;
}

export interface GrupoMatriz {
  grupo: {
    id: string;
    codigo: string;
    nombre: string;
    icono: string | null;
    orden: number;
    estado: number;
  };
  habilitado: 'todos' | 'parcial' | 'ninguno';
  modulos: ModuloConHabilitado[];
}

export interface OrganizacionModulosAdminRepository {
  /** Matriz completa del catálogo activo con el habilitado de esta organización (false si aún no tiene fila). */
  listarMatrizPorOrganizacion(organizacionId: string): Promise<GrupoMatriz[]>;
  toggle(
    organizacionId: string,
    moduloId: string,
    habilitado: boolean,
    usuarioEdicion: string,
    desactivarDependientes?: boolean,
  ): Promise<void>;
  toggleGrupo(
    organizacionId: string,
    grupoId: string,
    habilitado: boolean,
    usuarioEdicion: string,
    desactivarDependientes?: boolean,
  ): Promise<void>;
}
