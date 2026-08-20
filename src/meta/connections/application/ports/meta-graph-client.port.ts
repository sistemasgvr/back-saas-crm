export const META_GRAPH_CLIENT = Symbol('META_GRAPH_CLIENT');

export interface TokenIntercambiado {
  accessToken: string;
  expiraEnSegundos?: number;
}

export interface MetaUsuario {
  id: string;
  nombre: string;
}

/** DTOs con sufijo "Graph" a propósito: no confundir con los modelos Prisma MetaPagina/MetaCuentaPublicitaria (Fase 13). */
export interface MetaPaginaGraph {
  id: string;
  nombre: string;
}

export interface MetaCuentaPublicitariaGraph {
  id: string;
  nombre: string;
}

export interface MetaCuentaPublicitariaDetalleGraph {
  id: string;
  nombre: string;
  moneda?: string;
  estadoCuenta?: string;
  timezone?: string;
}

export interface MetaCampoLead {
  name: string;
  values: string[];
}

export interface MetaLeadGraph {
  leadgenId: string;
  formId?: string;
  adId?: string;
  adsetId?: string;
  campaignId?: string;
  createdTime?: Date;
  fieldData: MetaCampoLead[];
  raw: unknown;
}

export interface MetaCampanaGraph {
  id: string;
  nombre: string;
  estado?: string;
}

export interface MetaConjuntoAnuncioGraph {
  id: string;
  nombre: string;
  campanaId: string;
  estado?: string;
}

export interface MetaAnuncioGraph {
  id: string;
  nombre: string;
  conjuntoAnuncioId: string;
  estado?: string;
}

export interface MetaFormularioGraph {
  id: string;
  nombre: string;
  estado?: string;
  locale?: string;
}

export interface FiltroLeadsDeForm {
  desde?: Date;
  hasta?: Date;
  despues?: string;
  limit?: number;
}

export interface PaginaLeadsDeForm {
  leads: MetaLeadGraph[];
  siguienteCursor?: string;
}

export interface AppSuscritaGraph {
  id: string;
  camposSuscritos: string[];
}

export interface FiltroInsights {
  desde: string;
  hasta: string;
  nivel: 'account' | 'campaign';
}

export interface DebugTokenGraph {
  isValid: boolean;
  scopes: string[];
  expiresAt?: Date;
}

export interface MetaInsightGraph {
  fecha: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr?: number;
  cpc?: number;
  reach?: number;
  moneda?: string;
  campanaMetaId?: string;
  campanaNombre?: string;
}

export interface MetaGraphClient {
  /** appId/appSecret son de la Meta App propia de la organización, no de la plataforma. */
  intercambiarCodigoPorToken(
    code: string,
    redirectUri: string,
    appId: string,
    appSecret: string,
  ): Promise<TokenIntercambiado>;
  intercambiarPorTokenLargaDuracion(
    shortLivedToken: string,
    appId: string,
    appSecret: string,
  ): Promise<TokenIntercambiado>;
  obtenerUsuario(accessToken: string): Promise<MetaUsuario>;
  listarPaginas(accessToken: string): Promise<MetaPaginaGraph[]>;
  listarCuentasPublicitarias(
    accessToken: string,
  ): Promise<MetaCuentaPublicitariaGraph[]>;
  obtenerCuentaPublicitaria(
    adAccountId: string,
    accessToken: string,
  ): Promise<MetaCuentaPublicitariaDetalleGraph | null>;
  obtenerLead(leadgenId: string, accessToken: string): Promise<MetaLeadGraph>;
  obtenerAccessTokenPagina(
    pageId: string,
    userAccessToken: string,
  ): Promise<string | null>;
  suscribirPaginaLeadgen(
    pageId: string,
    pageAccessToken: string,
  ): Promise<void>;
  desuscribirPaginaLeadgen(
    pageId: string,
    pageAccessToken: string,
  ): Promise<void>;
  obtenerNombreRecurso(
    metaId: string,
    accessToken: string,
  ): Promise<string | null>;
  listarCampanasDeCuenta(
    adAccountId: string,
    accessToken: string,
  ): Promise<MetaCampanaGraph[]>;
  listarConjuntosDeCampana(
    campanaId: string,
    accessToken: string,
  ): Promise<MetaConjuntoAnuncioGraph[]>;
  listarAnunciosDeConjunto(
    conjuntoId: string,
    accessToken: string,
  ): Promise<MetaAnuncioGraph[]>;
  listarLeadgenForms(
    pageId: string,
    pageAccessToken: string,
  ): Promise<MetaFormularioGraph[]>;
  listarLeadsDeForm(
    formId: string,
    pageAccessToken: string,
    filtro: FiltroLeadsDeForm,
  ): Promise<PaginaLeadsDeForm>;
  obtenerAppsSuscritas(
    pageId: string,
    pageAccessToken: string,
  ): Promise<AppSuscritaGraph[]>;
  obtenerInsights(
    adAccountId: string,
    accessToken: string,
    filtro: FiltroInsights,
  ): Promise<MetaInsightGraph[]>;
  debugToken(
    inputToken: string,
    appId: string,
    appSecret: string,
  ): Promise<DebugTokenGraph>;
  /** DELETE /{user-id}/permissions/{permission} — revoca un scope puntual sin
   * cerrar la sesión completa (PLAN.md Fase 16). */
  revocarPermiso(
    metaUserId: string,
    permiso: string,
    accessToken: string,
  ): Promise<void>;
}
