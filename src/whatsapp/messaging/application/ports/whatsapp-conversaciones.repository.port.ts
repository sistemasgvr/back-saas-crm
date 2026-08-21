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
}

export interface WhatsappConversacionesRepository {
  listar(
    organizacionId: string,
    filtro: FiltroVisibilidadChats,
  ): Promise<ConversacionResumen[]>;
  findPorId(
    organizacionId: string,
    id: string,
  ): Promise<ConversacionResumen | null>;
  listarMensajes(
    whatsappConversacionId: string,
    limite: number,
  ): Promise<MensajeRow[]>;
  marcarLeida(id: string): Promise<void>;

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
}
