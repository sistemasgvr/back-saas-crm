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

/** Listado Graph con señal de tope de paginación (MAX_PAGINAS_GRAPH en el client). */
export interface ListadoGraph<T> {
  items: T[];
  truncado: boolean;
}

export interface MetaFormularioGraph {
  id: string;
  nombre: string;
  estado?: string;
  locale?: string;
}

/** Un número de WhatsApp descubierto vía el WABA del negocio — Business
 * Management API (PLAN-GESTION-LEADS-WHATSAPP.md §4.3 / Fase G3). */
export interface MetaNumeroWhatsAppGraph {
  wabaId: string;
  wabaNombre: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  codeVerificationStatus?: string;
  qualityRating?: string;
}

export interface MetaPlantillaWhatsAppGraph {
  nombre: string;
  idioma: string;
  categoria: string;
  estado: string;
  /** Texto crudo del BODY (con {{1}}, {{2}}… si los tiene) — el front cuenta
   * variables desde acá para pedir sus valores antes de enviar. */
  cuerpoTexto?: string;
  encabezadoTexto?: string;
}

export interface MetaMensajeWhatsAppEnviado {
  wamid: string;
}

export interface CrearPlantillaWhatsAppInput {
  nombre: string;
  categoria: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  idioma: string;
  /** Puede incluir variables {{1}}, {{2}}… — si las tiene, `ejemplosCuerpo`
   * debe traer un valor de muestra por cada una (Meta exige ejemplos para
   * revisar la plantilla). */
  cuerpo: string;
  ejemplosCuerpo?: string[];
  encabezado?: string;
  /** Solo admite UNA variable {{1}} — límite de Meta para el header. */
  ejemploEncabezado?: string;
  pie?: string;
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
  ): Promise<ListadoGraph<MetaCampanaGraph>>;
  listarConjuntosDeCampana(
    campanaId: string,
    accessToken: string,
  ): Promise<ListadoGraph<MetaConjuntoAnuncioGraph>>;
  listarAnunciosDeConjunto(
    conjuntoId: string,
    accessToken: string,
  ): Promise<ListadoGraph<MetaAnuncioGraph>>;
  listarLeadgenForms(
    pageId: string,
    pageAccessToken: string,
  ): Promise<MetaFormularioGraph[]>;
  listarLeadsDeForm(
    formId: string,
    pageAccessToken: string,
    filtro: FiltroLeadsDeForm,
  ): Promise<PaginaLeadsDeForm>;
  /** Resuelve el nombre de varios objetos (campaña/conjunto/anuncio) en UNA
   * sola HTTP round-trip vía Graph Batch API (no `ids=`, deprecado en v26.0+)
   * — evita N llamadas individuales cuando un backfill procesa muchos leads
   * con pocos recursos distintos (PLAN-FASE-14 §4.3). */
  obtenerNombresRecursos(
    metaIds: string[],
    accessToken: string,
  ): Promise<Map<string, string | null>>;
  /** Total real de leads que Meta tiene para el formulario — campo leads_count
   * del propio objeto Lead Gen Form (no lista leads, solo trae el conteo). Para
   * comparar contra lo ya importado, sin pagar el costo de listar/enriquecer. */
  contarLeadsDeForm(formId: string, pageAccessToken: string): Promise<number>;
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

  // --- WhatsApp Cloud API / Business Management (Fase G3) ---
  /** GET /me/businesses con expansión anidada a WABAs → phone_numbers — un
   * solo round-trip para descubrir todo lo vinculable (Business Management API). */
  listarNumerosWhatsApp(
    accessToken: string,
  ): Promise<MetaNumeroWhatsAppGraph[]>;
  suscribirWabaWebhook(wabaId: string, accessToken: string): Promise<void>;
  desuscribirWabaWebhook(wabaId: string, accessToken: string): Promise<void>;
  obtenerAppsSuscritasWaba(
    wabaId: string,
    accessToken: string,
  ): Promise<AppSuscritaGraph[]>;
  listarPlantillasWhatsApp(
    wabaId: string,
    accessToken: string,
  ): Promise<MetaPlantillaWhatsAppGraph[]>;
  /** POST /{waba-id}/message_templates — queda en PENDING hasta que Meta la
   * revise (horas a días); no se puede enviar hasta que quede APPROVED. */
  crearPlantillaWhatsApp(
    wabaId: string,
    accessToken: string,
    input: CrearPlantillaWhatsAppInput,
  ): Promise<void>;
  /** POST /{phone-number-id}/messages — sesión libre (dentro de la ventana 24h). */
  enviarMensajeTextoWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    texto: string,
  ): Promise<MetaMensajeWhatsAppEnviado>;
  /** POST /{phone-number-id}/messages type=template — primer contacto o fuera
   * de la ventana 24h; requiere plantilla ya aprobada por Meta. */
  enviarMensajePlantillaWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    nombrePlantilla: string,
    idioma: string,
    /** Valores para {{1}}, {{2}}… del BODY, en orden — vacío/omitido si la
     * plantilla no tiene variables. */
    parametros?: string[],
  ): Promise<MetaMensajeWhatsAppEnviado>;
}
