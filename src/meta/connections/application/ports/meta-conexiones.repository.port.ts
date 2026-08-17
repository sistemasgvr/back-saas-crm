import type { MetaConexion } from '@prisma/client';

export const META_CONEXIONES_REPOSITORY = Symbol('META_CONEXIONES_REPOSITORY');

export interface UpsertConexionInput {
  organizacionId: string;
  metaUserId: string;
  metaUserNombre?: string;
  tokenCifrado: string;
  tokenExpiraEn?: Date;
  scopes?: string;
  usuarioEdicion: string;
}

export interface MetaConexionesRepository {
  findActivaPorOrganizacion(organizacionId: string): Promise<MetaConexion | null>;
  findActivaPorPageId(pageId: string): Promise<MetaConexion | null>;
  /** Crea la conexión si no existe una activa para la org, o reemplaza el token si ya existe (reconexión). */
  upsertPorOrganizacion(input: UpsertConexionInput): Promise<MetaConexion>;
  actualizarPagina(
    id: string,
    pageId: string,
    pageNombre: string,
    usuarioEdicion: string,
  ): Promise<MetaConexion>;
  actualizarCuentaPublicitaria(
    id: string,
    adAccountId: string,
    adAccountNombre: string,
    usuarioEdicion: string,
  ): Promise<MetaConexion>;
  desactivar(id: string, usuarioEdicion: string): Promise<void>;
}
