/**
 * Identidad de un contacto WhatsApp según el modelo Meta 2026
 * (usernames + Business-scoped user IDs / BSUID).
 *
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/
 *
 * - `waId` (teléfono): puede omitirse si el usuario activó username privacy.
 * - `bsuid` (`user_id` / `from_user_id`): identificador estable para chatear.
 * - `username`: opcional y cambiable; no es clave de conversación.
 */

export interface IdentidadContactoWhatsApp {
  /** Dígitos E.164 sin '+' — null si Meta no lo mandó. */
  waId: string | null;
  /** Business-scoped user ID — null solo en payloads legacy. */
  bsuid: string | null;
  username: string | null;
  nombrePerfil: string | null;
}

/** True si el string parece teléfono (solo dígitos, longitud típica). */
export function pareceTelefonoWhatsApp(valor: string | null | undefined): boolean {
  if (!valor) return false;
  const digitos = valor.replace(/\D/g, '');
  return digitos.length >= 8 && digitos.length <= 15 && /^\d+$/.test(digitos);
}

/**
 * Destinatario para Graph API: `to` = teléfono, `recipient` = BSUID.
 * Si hay ambos, Meta prioriza `to`.
 */
export function payloadDestinatarioWhatsApp(input: {
  waId?: string | null;
  bsuid?: string | null;
}): { to?: string; recipient?: string } {
  const wa = input.waId?.replace(/\D/g, '') || null;
  if (wa && pareceTelefonoWhatsApp(wa)) {
    return { to: wa };
  }
  const bsuid = input.bsuid?.trim() || null;
  if (bsuid) {
    return { recipient: bsuid };
  }
  throw new Error('Sin teléfono ni BSUID para enviar el mensaje de WhatsApp');
}

export function etiquetaContactoWhatsApp(input: {
  nombre?: string | null;
  username?: string | null;
  waId?: string | null;
  bsuid?: string | null;
}): string {
  const nombre = input.nombre?.trim();
  if (nombre) return nombre;
  const user = input.username?.trim();
  if (user) return user.startsWith('@') ? user : `@${user}`;
  if (input.waId && pareceTelefonoWhatsApp(input.waId)) {
    return `+${input.waId.replace(/\D/g, '')}`;
  }
  if (input.bsuid) return `WhatsApp ${input.bsuid.slice(0, 8)}…`;
  return 'WhatsApp';
}

/** Identificador para Graph: teléfono o BSUID. Null si la conversación no tiene ninguno. */
export function idParaEnvioWhatsApp(input: {
  waId?: string | null;
  bsuid?: string | null;
}): string | null {
  const wa = input.waId?.trim();
  if (wa) return wa;
  const bsuid = input.bsuid?.trim();
  return bsuid || null;
}
