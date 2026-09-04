import type { Organizacion, Prisma } from '@prisma/client';

export const ORGANIZACIONES_REPOSITORY = Symbol('ORGANIZACIONES_REPOSITORY');

export interface ActualizarOrganizacionInput {
  nombre?: string;
  razonSocial?: string;
  documentoFiscal?: string;
  emailContacto?: string;
  telefonoContacto?: string;
  logoUrl?: string;
  pais?: string;
  zonaHoraria?: string;
}

export interface OrganizacionesRepository {
  findActivaById(id: string): Promise<Organizacion | null>;
  actualizar(
    id: string,
    data: ActualizarOrganizacionInput,
    usuarioEdicion: string,
  ): Promise<Organizacion>;
  /** Null = org usa matrices de código. */
  obtenerPipelineConfig(organizacionId: string): Promise<Prisma.JsonValue | null>;
  /** Null limpia el override (vuelve a defaults de código). */
  actualizarPipelineConfig(
    organizacionId: string,
    config: Prisma.InputJsonValue | null,
    usuarioEdicion: string,
  ): Promise<void>;
}
