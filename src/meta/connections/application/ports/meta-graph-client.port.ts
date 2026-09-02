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
  /** Texto crudo del BODY (con {{nombre}} o, en plantillas legacy creadas
   * fuera de este CRM, {{1}}, {{2}}…) — el front extrae los nombres de acá
   * para pedir sus valores antes de enviar. */
  cuerpoTexto?: string;
  encabezadoTexto?: string;
  /** 'NAMED' | 'POSITIONAL' — cómo Meta espera los parámetros al enviar esta
   * plantilla (`parameter_format`). Este CRM solo CREA plantillas 'NAMED',
   * pero una plantilla creada fuera del CRM (ej. Meta Business Manager)
   * puede ser 'POSITIONAL' — el envío debe respetar el formato real de cada
   * plantilla, no asumir que todas son 'NAMED'. */
  formatoParametros?: string;
}

export interface MetaMensajeWhatsAppEnviado {
  wamid: string;
}

export type TipoMediaWhatsApp =
  'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface MetaMediaSubidoGraph {
  /** Válido 30 días — se usa enseguida para enviar, no se guarda para después. */
  mediaId: string;
}

export interface MetaMediaDescargadoGraph {
  buffer: Buffer;
  mimeType: string;
}

/** Un valor de ejemplo para una variable con nombre, en la creación de una plantilla. */
export interface EjemploVariablePlantilla {
  nombre: string;
  ejemplo: string;
}

/** Un valor real para una variable, al enviar un mensaje de plantilla. */
export interface ParametroPlantilla {
  nombre: string;
  valor: string;
}

export interface CrearPlantillaWhatsAppInput {
  nombre: string;
  categoria: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  idioma: string;
  /** Puede incluir variables con nombre {{nombre_cliente}}… — si las tiene,
   * `variablesCuerpo` debe traer un ejemplo por cada una (Meta exige
   * ejemplos para revisar la plantilla). Siempre se crea con
   * parameter_format: "named". */
  cuerpo: string;
  variablesCuerpo?: EjemploVariablePlantilla[];
  encabezado?: string;
  /** Solo admite UNA variable — límite de Meta para el header. */
  variableEncabezado?: EjemploVariablePlantilla;
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
  /** POST /{phone-number-id}/messages — sesión libre (dentro de la ventana 24h).
   * `respondeAWamid`, si viene, agrega `context: { message_id }` al payload —
   * es lo que hace que Meta muestre la burbuja de "respondió a" en WhatsApp
   * del contacto (límite de Meta: solo mensajes de los últimos 30 días). */
  enviarMensajeTextoWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    texto: string,
    respondeAWamid?: string,
  ): Promise<MetaMensajeWhatsAppEnviado>;
  /** POST /{phone-number-id}/messages type=reaction — emoji vacío ("") saca
   * la reacción que ya estuviera puesta, no hace falta un endpoint aparte. */
  enviarReaccionWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    wamidObjetivo: string,
    emoji: string,
  ): Promise<void>;
  /** POST /{phone-number-id}/messages type=template — primer contacto o fuera
   * de la ventana 24h; requiere plantilla ya aprobada por Meta. */
  enviarMensajePlantillaWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    nombrePlantilla: string,
    idioma: string,
    /** Valores para las variables del BODY — vacío/omitido si la plantilla
     * no tiene variables. */
    parametros?: ParametroPlantilla[],
    /** 'NAMED' (default) envía `parameter_name` por cada parámetro;
     * 'POSITIONAL' los envía en orden, sin nombre — para plantillas legacy
     * creadas fuera de este CRM. */
    formatoParametros?: string,
  ): Promise<MetaMensajeWhatsAppEnviado>;

  /**
   * POST /{dataset-id}/events — Conversions API para CRM (Conversion Leads).
   * Manda el resultado de un lead (ganado/perdido/descartado) de vuelta a
   * Meta para que optimice la entrega de Lead Ads por calidad real, no solo
   * por volumen (PLAN-PIPELINE-INMOBILIARIA.md §20.5 / Oleada C).
   * `eventoId` debe ser único y estable por evento (se usa el id de la fila
   * de lead_estado_historial) — Meta lo usa para deduplicar reintentos.
   */
  enviarEventoConversionLead(
    datasetId: string,
    accessToken: string,
    evento: {
      nombreEvento: string;
      fechaEvento: Date;
      eventoId: string;
      leadIdMeta: string;
    },
  ): Promise<void>;

  /** POST /{phone-number-id}/media (multipart) — subir el archivo es
   * obligatorio antes de poder enviarlo; el media_id que devuelve dura
   * 30 días (WhatsApp Business Platform, Media API, vigente v26). */
  subirMediaWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    buffer: Buffer,
    mimeType: string,
    nombreArchivo?: string,
  ): Promise<MetaMediaSubidoGraph>;
  /** GET /{media-id} para resolver la URL firmada (dura 5 minutos) + la
   * descarga en la misma llamada — no tiene sentido exponer la URL firmada
   * sola, expira casi enseguida. */
  descargarMediaWhatsApp(
    mediaId: string,
    accessToken: string,
  ): Promise<MetaMediaDescargadoGraph>;
  /** POST /{phone-number-id}/messages type=image|video|audio|document|sticker
   * — la plantilla no aplica acá: los mensajes de media libres solo se
   * pueden mandar DENTRO de la ventana de 24h (igual que el texto). */
  enviarMediaWhatsApp(
    phoneNumberId: string,
    accessToken: string,
    para: string,
    tipo: TipoMediaWhatsApp,
    mediaId: string,
    opciones?: { caption?: string; filename?: string; respondeAWamid?: string },
  ): Promise<MetaMensajeWhatsAppEnviado>;
}
