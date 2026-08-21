export const WHATSAPP_CONEXIONES_REPOSITORY = Symbol(
  'WHATSAPP_CONEXIONES_REPOSITORY',
);

export interface WhatsappConexionRow {
  id: string;
  organizacionId: string;
  metaConexionId: string;
  wabaId: string;
  phoneNumberId: string;
  numeroDisplay: string | null;
  nombreVerificado: string | null;
  estadoNumero: string | null;
  webhookSuscrito: boolean;
  webhookSuscritoEn: Date | null;
  webhookUltimoCheckEn: Date | null;
  webhookUltimoError: string | null;
  fechaCreacion: Date;
}

export interface VincularNumeroInput {
  organizacionId: string;
  metaConexionId: string;
  wabaId: string;
  phoneNumberId: string;
  numeroDisplay?: string;
  nombreVerificado?: string;
  estadoNumero?: string;
  usuarioEdicion: string;
}

export interface WhatsappConexionesRepository {
  listarPorOrganizacion(organizacionId: string): Promise<WhatsappConexionRow[]>;
  listarPhoneNumberIdsVinculados(organizacionId: string): Promise<string[]>;
  findPorId(
    organizacionId: string,
    id: string,
  ): Promise<WhatsappConexionRow | null>;
  /** Sin scope de organización — el webhook llega sin contexto de sesión, hay
   * que resolver a qué org pertenece el phone_number_id que Meta notifica. */
  findPorPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsappConexionRow | null>;
  /** Crea o reactiva (si estaba soft-deleted) — evita duplicar la vinculación. */
  vincular(input: VincularNumeroInput): Promise<WhatsappConexionRow>;
  desvincular(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<WhatsappConexionRow | null>;
  marcarWebhookSuscrito(id: string, usuarioEdicion: string): Promise<void>;
  marcarWebhookCheck(
    id: string,
    suscrito: boolean,
    error: string | null,
  ): Promise<void>;
}
