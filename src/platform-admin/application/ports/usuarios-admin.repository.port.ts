import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import type { Usuario } from '@prisma/client';
import type { ResultadoPaginado } from '../../../shared/application/paginacion';

export const USUARIOS_ADMIN_REPOSITORY = Symbol('USUARIOS_ADMIN_REPOSITORY');

export interface CrearUsuarioInput {
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  esAdminPlataforma?: boolean;
}

export interface MembresiaUsuario {
  organizacionId: string;
  organizacionNombre: string;
  rol: RolOrganizacion;
  estado: number;
}

export interface UsuarioConMembresias extends Usuario {
  organizacionUsuarios: MembresiaUsuario[];
}

export interface FiltroListadoUsuarios {
  page: number;
  pageSize: number;
  q?: string;
  estado?: 0 | 1;
  esAdminPlataforma?: 0 | 1;
}

export interface UsuariosAdminRepository {
  listar(filtro: FiltroListadoUsuarios): Promise<ResultadoPaginado<Usuario>>;
  obtenerPorId(id: string): Promise<UsuarioConMembresias | null>;
  buscarActivoPorEmail(email: string): Promise<Usuario | null>;
  crear(input: CrearUsuarioInput, passwordHash: string, usuarioCreacion: string): Promise<Usuario>;
  cambiarEstado(id: string, estado: 0 | 1, usuarioEdicion: string): Promise<Usuario>;
  /** Crea o reactiva la membresía (upsert) — un usuario puede pertenecer a varias organizaciones. */
  asignarAOrganizacion(
    usuarioId: string,
    organizacionId: string,
    rol: RolOrganizacion,
    usuarioEdicion: string,
  ): Promise<void>;
}
