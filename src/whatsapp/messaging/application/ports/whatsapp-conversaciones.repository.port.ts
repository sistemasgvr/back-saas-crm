export const WHATSAPP_CONVERSACIONES_REPOSITORY = Symbol(
  'WHATSAPP_CONVERSACIONES_REPOSITORY',
);

export interface ReferenciaNombrada {
  id: string;
  nombre: string;
}

export interface ConversacionResumen {
  id: string;
  waId: string;
  nombreContacto: string | null;
  lead: (ReferenciaNombrada & { asignadoUsuarioId: string | null }) | null;
  ultimoMensajeEn: Date | null;
  ventanaExpiraEn: Date | null;
  noLeidos: number;
  ultimoMensajeTexto: string | null;
}

export interface MensajeRow {
  id: string;
  wamid: string;
  direccion: string;
  tipo: string;
  texto: string | null;
  plantillaNombre: string | null;
  estadoEntrega: string | null;
  fechaMensaje: Date;
  /** true si este mensaje tiene un archivo asociado — el front pide los
   * bytes aparte, vía GET .../messages/:id/media, solo cuando hace falta. */
  tieneMedia: boolean;
  mediaMimeType: string | null;
  mediaNombreArchivo: string | null;
  mediaCaption: string | null;
  mediaEsVoz: boolean | null;
  mediaTamanoBytes: number | null;
  /** Emoji que puso nuestra org sobre este mensaje — null si ninguno. */
  reaccionAgente: string | null;
  /** Emoji que puso el contacto sobre este mensaje — null si ninguno. */
  reaccionCliente: string | null;
  /** Mensaje citado (respuesta contextual) — null si este mensaje no responde a nada. */
  respondeA: MensajeCitado | null;
  /** Solo si tipo === 'location'. */
  ubicacion: UbicacionMensajeRow | null;
  /** Solo si tipo === 'contacts' — puede traer varios. */
  contactos: ContactoMensajeRow[] | null;
  /** Cuándo el contacto editó este mensaje por última vez — null si nunca. */
  fechaEdicion: Date | null;
  /** Solo si tipo === 'interactive' — lo que NOSOTROS mandamos (botones/
   * lista/link/pedido de ubicación). La respuesta del contacto llega como
   * mensaje normal (tipo 'button_reply'/'list_reply'), no usa este campo. */
  interactivo: InteractivoMensajeRow | null;
}

export interface UbicacionMensajeRow {
  latitud: number;
  longitud: number;
  nombre: string | null;
  direccion: string | null;
}

export interface ContactoMensajeRow {
  nombre: string;
  telefonos: { numero: string; tipo?: string }[];
  organizacion?: string;
}

export interface BotonInteractivoRow {
  id: string;
  titulo: string;
}

export interface FilaListaRow {
  id: string;
  titulo: string;
  descripcion?: string;
}

export interface SeccionListaRow {
  titulo?: string;
  filas: FilaListaRow[];
}

/** Forma ya normalizada (no la cruda de Meta) de un mensaje interactivo
 * SALIENTE — cubre los 4 subtipos que soporta este CRM. Los campos que no
 * aplican al subtipo elegido quedan undefined. */
export interface InteractivoMensajeRow {
  subtipo: 'button' | 'list' | 'cta_url' | 'location_request';
  cuerpo: string;
  pie?: string;
  /** Solo subtipo 'button' — hasta 3. */
  botones?: BotonInteractivoRow[];
  /** Solo subtipo 'list' — etiqueta del botón que abre el picker. */
  botonLista?: string;
  /** Solo subtipo 'list'. */
  secciones?: SeccionListaRow[];
  /** Solo subtipo 'cta_url'. */
  textoBoton?: string;
  url?: string;
}

/** Vista chica del mensaje citado — lo justo para pintar la burbujita de cita. */
export interface MensajeCitado {
  id: string;
  direccion: string;
  tipo: string;
  texto: string | null;
  tieneMedia: boolean;
  mediaCaption: string | null;
}

export interface MensajeResuelto {
  id: string;
  wamid: string;
  whatsappConversacionId: string;
}

export interface MediaMensaje {
  bytes: Buffer;
  mimeType: string;
  nombreArchivo: string | null;
}

/** Ve todo (modo 'todos') o solo conversaciones cuyo lead está asignado a él
 * (modo 'usuario') — mismo patrón de FiltroAsignacion de leads (§3). */
export type FiltroVisibilidadChats =
  { modo: 'todos' } | { modo: 'usuario'; usuarioId: string };

export interface RegistrarMensajeInput {
  organizacionId: string;
  whatsappConversacionId: string;
  wamid: string;
  direccion: 'entrante' | 'saliente';
  tipo: string;
  texto?: string;
  plantillaNombre?: string;
  estadoEntrega?: string;
  datosCrudos: unknown;
  fechaMensaje: Date;
  usuarioCreacion?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaNombreArchivo?: string;
  mediaCaption?: string;
  mediaEsVoz?: boolean;
  mediaTamanoBytes?: number;
  /** Si viene, se persiste en la tabla aparte WhatsappMensajeMedia en la
   * misma escritura — entrante: ya descargado de Meta al llegar el webhook
   * (el media_id de Meta solo dura 7 días). Saliente: los bytes que el
   * usuario subió, antes de mandarlos a Meta. */
  mediaBytes?: Buffer;
  /** Id PROPIO (no wamid) del mensaje que este responde/cita — ya resuelto
   * por el use-case antes de llamar acá. */
  respondeAMensajeId?: string;
  /** Solo si tipo === 'location'. */
  ubicacionLatitud?: number;
  ubicacionLongitud?: number;
  ubicacionNombre?: string;
  ubicacionDireccion?: string;
  /** Solo si tipo === 'contacts'. */
  contactos?: ContactoMensajeRow[];
  /** Solo si tipo === 'interactive'. */
  interactivo?: InteractivoMensajeRow;
}

export interface WhatsappConversacionesRepository {
  listar(
    organizacionId: string,
    filtro: FiltroVisibilidadChats,
  ): Promise<ConversacionResumen[]>;
  /** Cantidad de conversaciones visibles con `noLeidos > 0` (no la suma de
   * mensajes) — para el badge del sidebar, sin traer la lista completa solo
   * para contar. */
  contarNoLeidos(
    organizacionId: string,
    filtro: FiltroVisibilidadChats,
  ): Promise<number>;
  findPorId(
    organizacionId: string,
    id: string,
  ): Promise<ConversacionResumen | null>;
  listarMensajes(
    whatsappConversacionId: string,
    limite: number,
  ): Promise<MensajeRow[]>;
  marcarLeida(id: string): Promise<void>;

  /** wamid del último mensaje ENTRANTE de la conversación — el que hay que
   * marcar como leído/con "escribiendo…" en Meta (la confirmación de
   * lectura de WhatsApp va sobre el mensaje del contacto, no sobre uno
   * nuestro). Null si el contacto todavía no escribió nada. */
  buscarUltimoWamidEntrante(
    whatsappConversacionId: string,
  ): Promise<string | null>;

  /** Vincula conversaciones existentes sin lead cuyo wa_id coincide con el
   * teléfono del lead (heurística de sufijo / E.164). No pisa un lead_id ya
   * asignado. Devuelve cuántas filas se actualizaron. */
  vincularLeadPorTelefono(
    organizacionId: string,
    leadId: string,
    telefono: string,
  ): Promise<number>;

  /** Crea la conversación si no existe (por wa_id). Si `leadIdConocido` viene
   * dado (CTA "Iniciar chat" desde una ficha de lead puntual), se vincula
   * directo a ese lead; si no, intenta emparejar por teléfono (heurística,
   * puede fallar). Devuelve si ya existía (para no re-vincular lead en cada
   * mensaje si el usuario la desvinculó a mano después). */
  findOCrearConversacion(input: {
    organizacionId: string;
    whatsappConexionId: string;
    waId: string;
    nombreContacto?: string;
    leadIdConocido?: string;
  }): Promise<{ id: string; esNueva: boolean }>;

  /** Idempotente por (organizacionId, wamid) — Meta reintenta webhooks. */
  registrarMensaje(
    input: RegistrarMensajeInput,
  ): Promise<{ id: string; creado: boolean }>;

  /** Bytes de un mensaje con archivo — null si el mensaje no existe, no
   * pertenece a la organización, o no tiene media asociado. */
  obtenerMedia(
    organizacionId: string,
    mensajeId: string,
  ): Promise<MediaMensaje | null>;

  actualizarTrasEntrante(
    conversacionId: string,
    fechaMensaje: Date,
    nombreContacto?: string,
  ): Promise<void>;

  actualizarEstadoMensaje(
    organizacionId: string,
    wamid: string,
    estado: string,
  ): Promise<void>;

  /** Para resolver el wamid real (lo que pide Graph API) a partir del id
   * propio del mensaje — con chequeo de organización incluido. Se usa tanto
   * para reaccionar como para responder/citar un mensaje saliente. */
  buscarMensajePorId(
    organizacionId: string,
    mensajeId: string,
  ): Promise<MensajeResuelto | null>;

  /** La dirección inversa — el webhook entrante solo conoce el wamid del
   * mensaje citado, hace falta el id propio para guardar la relación. */
  buscarIdPorWamid(
    organizacionId: string,
    wamid: string,
  ): Promise<string | null>;

  /** Reacción que PONEMOS nosotros sobre un mensaje — emoji null = sin reacción. */
  actualizarReaccionAgente(
    organizacionId: string,
    mensajeId: string,
    emoji: string | null,
  ): Promise<void>;

  /** Reacción que puso el CONTACTO — se busca por wamid porque el webhook
   * solo conoce el id de Meta, no el id propio de la fila. */
  actualizarReaccionCliente(
    organizacionId: string,
    wamidObjetivo: string,
    emoji: string | null,
  ): Promise<void>;

  /** El contacto editó un mensaje que ya nos había mandado — se busca por
   * wamid, mismo motivo que la reacción. Pisa `texto`/`mediaCaption` con el
   * contenido nuevo (WhatsApp no guarda historial) y marca `fechaEdicion`. */
  actualizarMensajeEditado(
    organizacionId: string,
    wamidOriginal: string,
    cambios: { texto?: string; mediaCaption?: string },
    fechaEdicion: Date,
  ): Promise<void>;
}
