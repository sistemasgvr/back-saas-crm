import { RolOrganizacion } from '../../domain/request-context.interface';

export const ORGANIZACION_USUARIOS_REPOSITORY = Symbol('ORGANIZACION_USUARIOS_REPOSITORY');

export interface MembresiaActiva {
  organizacionId: string;
  organizacionNombre: string;
  organizacionSlug: string;
  rol: RolOrganizacion;
}

export interface OrganizacionUsuariosRepository {
  findMembresiasActivas(usuarioId: string): Promise<MembresiaActiva[]>;
  findMembresiaActiva(usuarioId: string, organizacionId: string): Promise<MembresiaActiva | null>;
}
