import type { Organizacion, Prisma } from '@prisma/client';
import type { ReubicacionEstado } from '../../../shared/domain/pipeline-inmobiliaria';

export const ORGANIZACIONES_REPOSITORY = Symbol('ORGANIZACIONES_REPOSITORY');

export interface ActualizarOrganizacionInput {
  nombre?: string;
  razonSocial?: string;
  documentoFiscal?: string;
  emailContacto?: string;
  telefonoContacto?: string;
  logoUrl?: string | null;
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
  obtenerPipelineConfig(
    organizacionId: string,
  ): Promise<Prisma.JsonValue | null>;
  /** Null limpia el override (vuelve a defaults de código). Las reubicaciones
   * mueven los leads de estados eliminados, en la misma transacción. */
  actualizarPipelineConfig(
    organizacionId: string,
    config: Prisma.InputJsonValue | null,
    usuarioEdicion: string,
    reubicaciones?: ReubicacionEstado[],
  ): Promise<number>;
  /** Leads activos de la org en ese estado (embudo OTRO incluye tipo null). */
  contarLeadsEnEstado(
    organizacionId: string,
    tipoLead: ReubicacionEstado['tipoLead'],
    estadoGestion: string,
  ): Promise<number>;
}
