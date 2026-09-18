export const WHATSAPP_LLAMADAS_REPOSITORY = Symbol(
  'WHATSAPP_LLAMADAS_REPOSITORY',
);

export interface WhatsappLlamadaRow {
  id: string;
  organizacionId: string;
  whatsappConexionId: string;
  conversacionId: string | null;
  leadId: string | null;
  asignadoUsuarioId: string | null;
  callId: string;
  waId: string | null;
  direccion: string;
  estado: string;
  resultado: string | null;
  inicioEn: Date;
  contestadaEn: Date | null;
  finEn: Date | null;
  duracionSeg: number | null;
  notaPostLlamada: string | null;
  motivo: string | null;
  errorCodigo: string | null;
  errorMensaje: string | null;
  fechaCreacion: Date;
}

export interface UpsertLlamadaInput {
  organizacionId: string;
  whatsappConexionId: string;
  callId: string;
  waId?: string | null;
  conversacionId?: string | null;
  leadId?: string | null;
  direccion: string;
  estado: string;
  resultado?: string | null;
  inicioEn: Date;
  contestadaEn?: Date | null;
  finEn?: Date | null;
  duracionSeg?: number | null;
  errorCodigo?: string | null;
  errorMensaje?: string | null;
  datosCrudos?: unknown;
  /** Solo en create; en update se aplica si se pasa. */
  asignadoUsuarioId?: string | null;
}

export interface FiltroListarLlamadas {
  desde?: Date;
  hasta?: Date;
  asesorId?: string;
  resultado?: string;
  leadId?: string;
  conversacionId?: string;
  page?: number;
  pageSize?: number;
}

export interface ActualizarLlamadaCampos {
  notaPostLlamada?: string | null;
  motivo?: string | null;
  estado?: string;
  resultado?: string | null;
  contestadaEn?: Date | null;
  finEn?: Date | null;
  duracionSeg?: number | null;
  asignadoUsuarioId?: string | null;
  errorCodigo?: string | null;
  errorMensaje?: string | null;
  datosCrudos?: unknown;
}

export interface MetricasLlamadas {
  contestadas: number;
  perdidas: number;
  rechazadas: number;
  duracionMediaSeg: number | null;
  total: number;
  porAsesor: {
    asesorId: string;
    contestadas: number;
    total: number;
    duracionMediaSeg: number | null;
  }[];
}

export interface WhatsappLlamadasRepository {
  upsertPorCallId(input: UpsertLlamadaInput): Promise<WhatsappLlamadaRow>;
  findPorId(
    organizacionId: string,
    id: string,
  ): Promise<WhatsappLlamadaRow | null>;
  findPorCallId(
    organizacionId: string,
    callId: string,
  ): Promise<WhatsappLlamadaRow | null>;
  listar(
    organizacionId: string,
    filtro: FiltroListarLlamadas,
  ): Promise<{ items: WhatsappLlamadaRow[]; total: number; page: number }>;
  actualizar(
    organizacionId: string,
    id: string,
    campos: ActualizarLlamadaCampos,
  ): Promise<WhatsappLlamadaRow | null>;
  /**
   * Claim atómico: solo si `asignadoUsuarioId` es null y estado es
   * RINGING o PRE_ACCEPTED. Devuelve null si otro agente ya la tomó.
   */
  reclamar(
    organizacionId: string,
    callId: string,
    usuarioId: string,
  ): Promise<WhatsappLlamadaRow | null>;
  metricas(
    organizacionId: string,
    desde?: Date,
    hasta?: Date,
  ): Promise<MetricasLlamadas>;
}
