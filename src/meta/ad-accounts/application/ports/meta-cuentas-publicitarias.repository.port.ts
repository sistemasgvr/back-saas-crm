import type { ResultadoPaginado } from '../../../../shared/application/paginacion';

export const META_CUENTAS_PUBLICITARIAS_REPOSITORY = Symbol(
  'META_CUENTAS_PUBLICITARIAS_REPOSITORY',
);

export interface MetaCuentaPublicitariaRow {
  id: string;
  organizacionId: string;
  metaConexionId: string;
  adAccountId: string;
  nombre: string;
  moneda: string | null;
  estadoCuenta: string | null;
  timezone: string | null;
  ultimoSyncEn: Date | null;
  fechaCreacion: Date;
}

export interface VincularCuentaInput {
  organizacionId: string;
  metaConexionId: string;
  adAccountId: string;
  nombre: string;
  moneda?: string;
  estadoCuenta?: string;
  timezone?: string;
  usuarioEdicion: string;
}

export interface CampanaResumen {
  id: string;
  nombre: string;
  estadoMeta: string | null;
  totalLeads: number;
}

export interface CuentaFiltro {
  id: string;
  nombre: string;
}

export interface MetaCuentasPublicitariasRepository {
  listarPorOrganizacion(
    organizacionId: string,
    page: number,
    pageSize: number,
  ): Promise<ResultadoPaginado<MetaCuentaPublicitariaRow>>;
  /** Lectura mínima sin paginar, para poblar filtros de /dashboard (Fase 13.6). */
  listarActivasFiltro(organizacionId: string): Promise<CuentaFiltro[]>;
  contarActivasPorOrganizacion(organizacionId: string): Promise<number>;
  listarAdAccountIdsVinculados(organizacionId: string): Promise<string[]>;
  findPorId(
    organizacionId: string,
    id: string,
  ): Promise<MetaCuentaPublicitariaRow | null>;
  /** Crea o reactiva (si existía soft-deleted) la vinculación — evita filas duplicadas por re-vincular. */
  vincular(input: VincularCuentaInput): Promise<MetaCuentaPublicitariaRow>;
  actualizarUltimoSync(id: string, usuarioEdicion: string): Promise<void>;
  desvincular(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<MetaCuentaPublicitariaRow | null>;
  desvincularTodasDeOrganizacion(
    organizacionId: string,
    usuarioEdicion: string,
  ): Promise<MetaCuentaPublicitariaRow[]>;
  contarCampanas(metaCuentaPublicitariaId: string): Promise<number>;
  contarLeads(metaCuentaPublicitariaId: string): Promise<number>;
  listarUltimasCampanas(
    metaCuentaPublicitariaId: string,
    limite: number,
  ): Promise<CampanaResumen[]>;
}
