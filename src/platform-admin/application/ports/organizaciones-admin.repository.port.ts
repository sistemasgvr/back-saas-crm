import type { Organizacion } from '@prisma/client';
import type { ResultadoPaginado } from '../../../shared/application/paginacion';

export const ORGANIZACIONES_ADMIN_REPOSITORY = Symbol(
  'ORGANIZACIONES_ADMIN_REPOSITORY',
);

export interface CrearOrganizacionInput {
  nombre: string;
  slug: string;
  razonSocial?: string;
  documentoFiscal?: string;
  emailContacto?: string;
  telefonoContacto?: string;
  logoUrl?: string;
  pais?: string;
  zonaHoraria?: string;
  /** Único valor operativo hoy: INMOBILIARIA — PLAN-GESTION-LEADS-WHATSAPP.md §3. */
  rubro?: string;
}

export interface ActualizarOrganizacionAdminInput {
  nombre?: string;
  slug?: string;
  razonSocial?: string;
  documentoFiscal?: string;
  emailContacto?: string;
  telefonoContacto?: string;
  logoUrl?: string;
  pais?: string;
  zonaHoraria?: string;
  notas?: string;
  rubro?: string;
}

export interface FiltroListadoOrganizaciones {
  page: number;
  pageSize: number;
  q?: string;
  estado?: 0 | 1;
}

export interface OrganizacionesAdminRepository {
  listar(
    filtro: FiltroListadoOrganizaciones,
  ): Promise<ResultadoPaginado<Organizacion>>;
  obtenerPorId(id: string): Promise<Organizacion | null>;
  /** Crea la organización y sus organizacion_modulos por defecto (META_LEADS y DASHBOARD habilitados) — PLAN.md §5.1. */
  crearConModulosPorDefecto(
    input: CrearOrganizacionInput,
    usuarioCreacion: string,
  ): Promise<Organizacion>;
  actualizar(
    id: string,
    input: ActualizarOrganizacionAdminInput,
    usuarioEdicion: string,
  ): Promise<Organizacion>;
  desactivar(id: string, usuarioEdicion: string): Promise<Organizacion>;
}
