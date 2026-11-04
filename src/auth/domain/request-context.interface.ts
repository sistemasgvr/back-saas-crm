/** PERSONALIZADO = membresía con un rol personalizado de la empresa (rol_id). */
export type RolOrganizacion =
  'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO' | 'PERSONALIZADO';

export interface RequestContext {
  usuarioId: string;
  organizacionId?: string;
  rol?: RolOrganizacion;
  /** Permisos efectivos (rol ∩ módulos activos), calculados por OrgMembershipGuard. */
  permisos?: string[];
  esAdminPlataforma: boolean;
}
