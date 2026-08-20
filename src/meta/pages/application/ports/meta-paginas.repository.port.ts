import type { ResultadoPaginado } from '../../../../shared/application/paginacion';

export const META_PAGINAS_REPOSITORY = Symbol('META_PAGINAS_REPOSITORY');

export interface MetaPaginaRow {
  id: string;
  organizacionId: string;
  metaConexionId: string;
  pageId: string;
  nombre: string;
  webhookSuscrito: boolean;
  webhookSuscritoEn: Date | null;
  webhookUltimoCheckEn: Date | null;
  webhookUltimoError: string | null;
  fotoUrl: string | null;
  categoria: string | null;
  fechaCreacion: Date;
}

/** Página + credenciales de la conexión padre — usado por el webhook (routing + firma). */
export interface MetaPaginaConConexion {
  id: string;
  organizacionId: string;
  metaConexionId: string;
  pageId: string;
  nombre: string;
  tokenPaginaCifrado: string | null;
  conexionTokenCifrado: string | null;
  conexionAppSecretCifrado: string | null;
}

/** Solo para el flujo de desconexión total — necesita el token para desuscribir cada página del webhook. */
export interface MetaPaginaDesvinculada extends MetaPaginaRow {
  tokenPaginaCifrado: string | null;
}

export interface VincularPaginaInput {
  organizacionId: string;
  metaConexionId: string;
  pageId: string;
  nombre: string;
  tokenPaginaCifrado: string | null;
  webhookSuscrito: boolean;
  usuarioEdicion: string;
}

export interface PaginaFiltro {
  id: string;
  nombre: string;
}

export interface MetaPaginasRepository {
  listarPorOrganizacion(
    organizacionId: string,
    page: number,
    pageSize: number,
  ): Promise<ResultadoPaginado<MetaPaginaRow>>;
  /** Lectura mínima sin paginar, para poblar filtros de /leads (Fase 13.6). */
  listarActivasFiltro(organizacionId: string): Promise<PaginaFiltro[]>;
  contarActivasPorOrganizacion(organizacionId: string): Promise<number>;
  /** page_ids ya vinculados (activos) — para excluir del listado "available" desde Graph. */
  listarPageIdsVinculados(organizacionId: string): Promise<string[]>;
  findPorId(organizacionId: string, id: string): Promise<MetaPaginaRow | null>;
  findActivaPorPageId(pageId: string): Promise<MetaPaginaConConexion | null>;
  /** Crea o reactiva (si existía soft-deleted) la vinculación — evita filas duplicadas por re-vincular. */
  vincular(input: VincularPaginaInput): Promise<MetaPaginaRow>;
  actualizarWebhookSuscrito(
    id: string,
    suscrito: boolean,
    usuarioEdicion: string,
  ): Promise<void>;
  /** Health-check contra Graph (Fase 14.4) — no toca webhookSuscritoEn, solo el estado observado. */
  actualizarSaludWebhook(
    id: string,
    suscrito: boolean,
    error: string | null,
    usuarioEdicion: string,
  ): Promise<void>;
  desvincular(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<MetaPaginaRow | null>;
  desvincularTodasDeOrganizacion(
    organizacionId: string,
    usuarioEdicion: string,
  ): Promise<MetaPaginaDesvinculada[]>;
  contarLeadsTotal(metaPaginaId: string): Promise<number>;
  contarLeadsDesde(metaPaginaId: string, desde: Date): Promise<number>;
}
