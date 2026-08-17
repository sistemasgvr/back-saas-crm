import { RolOrganizacion } from './request-context.interface';

export interface AccessTokenPayload {
  sub: string;
  organizacionId?: string;
  rol?: RolOrganizacion;
  esAdminPlataforma: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  organizacionId?: string;
}
