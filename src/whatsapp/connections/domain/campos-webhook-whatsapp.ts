/** Campos del objeto WhatsApp Business Account que deben estar suscritos
 * en Meta App Dashboard para coexistencia (Cloud API + app Business).
 * Graph `POST /{wabaId}/subscribed_apps` no lista campos — la suscripción
 * de fields se hace en el Dashboard. */
export const CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA = [
  'messages',
  'smb_message_echoes',
  'history',
  'smb_app_state_sync',
] as const;

export type CampoWebhookWhatsappCoexistencia =
  (typeof CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA)[number];
