/** Campos del objeto WhatsApp Business Account que deben estar suscritos
 * en Meta App Dashboard para coexistencia (Cloud API + app Business).
 * Meta pide estos cuatro + `messages` en el onboarding de coexistencia;
 * `account_update` avisa si el número se desvincula (ACCOUNT_OFFBOARDED /
 * PARTNER_REMOVED por inactividad). Graph `POST /{wabaId}/subscribed_apps`
 * no lista campos — la suscripción de fields se hace en el Dashboard. */
export const CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA = [
  'messages',
  'smb_message_echoes',
  'history',
  'smb_app_state_sync',
  'account_update',
] as const;

/** Campos extra para línea Cloud API-only con Calling. */
export const CAMPOS_WEBHOOK_WHATSAPP_CALLING = [
  'calls',
  'account_settings_update',
] as const;

/** No son obligatorios, pero el CRM ya los procesa (alertas a admins, nombre
 * verificado, preferencias de marketing): conviene suscribirlos. */
export const CAMPOS_WEBHOOK_WHATSAPP_RECOMENDADOS = [
  'account_alerts',
  'account_review_update',
  'business_capability_update',
  'message_template_status_update',
  'message_template_quality_update',
  'template_category_update',
  'phone_number_name_update',
  'phone_number_quality_update',
  'security',
  'user_preferences',
] as const;

/** Reconocidos y registrados en log, sin acción en el CRM (todavía). Si se
 * suscriben no generan avisos de "campo desconocido". */
export const CAMPOS_WEBHOOK_WHATSAPP_INFORMATIVOS = [
  'message_template_components_update',
  'automatic_events',
  'partner_solutions',
  'payment_configuration_update',
  'pricing',
  'flows',
  'tracking_events',
  'group_lifecycle_update',
  'group_participants_update',
  'group_settings_update',
  'group_status_update',
] as const;

export const CAMPOS_WEBHOOK_WHATSAPP_TODOS = [
  ...CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA,
  ...CAMPOS_WEBHOOK_WHATSAPP_CALLING,
  ...CAMPOS_WEBHOOK_WHATSAPP_RECOMENDADOS,
  ...CAMPOS_WEBHOOK_WHATSAPP_INFORMATIVOS,
] as const;

export type CampoWebhookWhatsappCoexistencia =
  (typeof CAMPOS_WEBHOOK_WHATSAPP_COEXISTENCIA)[number];

export type CampoWebhookWhatsappCalling =
  (typeof CAMPOS_WEBHOOK_WHATSAPP_CALLING)[number];
