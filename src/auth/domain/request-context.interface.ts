export type RolOrganizacion = 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO';

export interface RequestContext {
  usuarioId: string;
  organizacionId?: string;
  rol?: RolOrganizacion;
  esAdminPlataforma: boolean;
}
