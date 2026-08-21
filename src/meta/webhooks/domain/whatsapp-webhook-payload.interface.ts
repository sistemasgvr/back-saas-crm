/** Payload de Meta para el objeto "whatsapp_business_account" — comparte el
 * mismo endpoint/firma que leadgen, se distingue por payload.object
 * (PLAN-GESTION-LEADS-WHATSAPP.md §4.3 / Fase G3). */
export interface WhatsappWebhookPayload {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }[];
        statuses?: {
          id?: string;
          status?: string;
          timestamp?: string;
        }[];
      };
    }[];
  }[];
}

export interface EventoMensajeWhatsApp {
  phoneNumberId: string;
  waId: string;
  nombreContacto?: string;
  wamid: string;
  timestamp: Date;
  tipo: string;
  texto?: string;
  raw: unknown;
}

export interface EventoEstadoWhatsApp {
  phoneNumberId: string;
  wamid: string;
  status: string;
  timestamp: Date;
}

function timestampADate(timestamp?: string): Date {
  return timestamp ? new Date(Number(timestamp) * 1000) : new Date();
}

export function extraerEventosWhatsApp(payload: WhatsappWebhookPayload): {
  mensajes: EventoMensajeWhatsApp[];
  estados: EventoEstadoWhatsApp[];
} {
  const mensajes: EventoMensajeWhatsApp[] = [];
  const estados: EventoEstadoWhatsApp[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const contactoPorWaId = new Map(
        (value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
      );

      for (const mensaje of value?.messages ?? []) {
        if (!mensaje.id || !mensaje.from) continue;
        mensajes.push({
          phoneNumberId,
          waId: mensaje.from,
          nombreContacto: contactoPorWaId.get(mensaje.from),
          wamid: mensaje.id,
          timestamp: timestampADate(mensaje.timestamp),
          tipo: mensaje.type ?? 'unknown',
          texto: mensaje.text?.body,
          raw: mensaje,
        });
      }

      for (const status of value?.statuses ?? []) {
        if (!status.id || !status.status) continue;
        estados.push({
          phoneNumberId,
          wamid: status.id,
          status: status.status,
          timestamp: timestampADate(status.timestamp),
        });
      }
    }
  }

  return { mensajes, estados };
}
