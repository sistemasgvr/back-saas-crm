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
          image?: MetaMediaObjeto;
          video?: MetaMediaObjeto;
          audio?: MetaMediaObjeto & { voice?: boolean };
          document?: MetaMediaObjeto & { filename?: string };
          sticker?: MetaMediaObjeto & { animated?: boolean };
          /** Solo presente cuando type === 'reaction' — message_id apunta
           * al wamid del mensaje NUESTRO que el contacto reaccionó, no al
           * id de este evento. emoji vacío significa que sacó la reacción. */
          reaction?: { message_id?: string; emoji?: string };
          /** Presente cuando este mensaje es una respuesta contextual —
           * "citó" otro mensaje. `id` es el wamid del mensaje citado. */
          context?: { from?: string; id?: string };
          /** Solo presente cuando type === 'location'. */
          location?: {
            latitude?: number;
            longitude?: number;
            name?: string;
            address?: string;
          };
          /** Solo presente cuando type === 'contacts' — puede traer varios
           * contactos en un mismo mensaje (WhatsApp lo permite). */
          contacts?: ContactoMetaCrudo[];
          /** Solo presente cuando type === 'edit' — el contacto editó un
           * mensaje que ya había mandado. `id` de este evento es un wamid
           * nuevo (el del evento de edición, no el del mensaje editado);
           * `edit.original_message_id` es el que hay que buscar en nuestra
           * base. WhatsApp solo permite editar el texto (mensajes de texto)
           * o el caption (mensajes con archivo) — nunca el archivo en sí.
           * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/edit/ */
          edit?: {
            original_message_id?: string;
            message?: {
              type?: string;
              text?: { body?: string };
              image?: MetaMediaObjeto;
              video?: MetaMediaObjeto;
              document?: MetaMediaObjeto;
              sticker?: MetaMediaObjeto;
            };
          };
          /** Solo presente cuando type === 'interactive' — el contacto tocó
           * un botón o eligió una opción de una lista que le mandamos.
           * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/interactive/ */
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string; description?: string };
          };
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

/** Un contacto tal cual lo manda Meta (formato vCard-ish) — ver
 * extraerContactos() para la traducción a nuestro propio vocabulario. */
export interface ContactoMetaCrudo {
  name?: { formatted_name?: string };
  org?: { company?: string };
  phones?: { phone?: string; type?: string; wa_id?: string }[];
}

/** Objeto de media que manda Meta en un mensaje entrante — `id` solo dura 7
 * días desde que llega el webhook, hay que descargarlo antes de que expire. */
export interface MetaMediaObjeto {
  id?: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface MediaEntranteWhatsApp {
  mediaId: string;
  mimeType?: string;
  caption?: string;
  nombreArchivo?: string;
  esVoz?: boolean;
}

/** Ya en nuestro propio vocabulario (no el crudo de Meta) — mismo shape que
 * usa RegistrarMensajeInput, así el use-case lo pasa directo sin traducir. */
export interface UbicacionMensaje {
  latitud: number;
  longitud: number;
  nombre?: string;
  direccion?: string;
}

export interface TelefonoContacto {
  numero: string;
  tipo?: string;
}

export interface ContactoMensaje {
  nombre: string;
  telefonos: TelefonoContacto[];
  organizacion?: string;
}

export interface EventoMensajeWhatsApp {
  phoneNumberId: string;
  waId: string;
  nombreContacto?: string;
  wamid: string;
  timestamp: Date;
  tipo: string;
  texto?: string;
  media?: MediaEntranteWhatsApp;
  /** wamid del mensaje que este citó al responder — resolver a nuestro id
   * propio queda del lado del use-case, acá solo se extrae el dato crudo. */
  respondeAWamid?: string;
  /** Solo presente cuando tipo === 'location'. */
  ubicacion?: UbicacionMensaje;
  /** Solo presente cuando tipo === 'contacts'. */
  contactos?: ContactoMensaje[];
  raw: unknown;
}

export interface EventoReaccionWhatsApp {
  phoneNumberId: string;
  /** wamid del mensaje NUESTRO que fue reaccionado, no de este evento. */
  wamidObjetivo: string;
  /** Vacío = el contacto sacó su reacción. */
  emoji: string;
}

export interface EventoEdicionWhatsApp {
  phoneNumberId: string;
  /** wamid del mensaje ORIGINAL que el contacto editó, no del evento de edición. */
  wamidOriginal: string;
  /** Presente si editó un mensaje de texto. */
  texto?: string;
  /** Presente si editó el caption de un archivo. */
  mediaCaption?: string;
  fechaEdicion: Date;
}

export interface EventoEstadoWhatsApp {
  phoneNumberId: string;
  wamid: string;
  /** Ya traducido al vocabulario propio (enviado/entregado/leido/fallido/
   * eliminado) — ver traducirEstadoWhatsApp(). El resto del sistema (BD,
   * front) nunca ve el valor crudo en inglés de Meta. */
  status: string;
  timestamp: Date;
}

function timestampADate(timestamp?: string): Date {
  return timestamp ? new Date(Number(timestamp) * 1000) : new Date();
}

/** Meta manda el status en inglés (sent/delivered/read/failed/deleted) — se
 * traduce acá, en el borde, para que el resto del sistema (columna en BD,
 * iconos del front) trabaje siempre con el mismo vocabulario en español que
 * ya usa `EnviarMensajeWhatsAppUseCase` al crear el mensaje ("enviado").
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#message-status-updates */
const TRADUCCION_ESTADO: Record<string, string> = {
  sent: 'enviado',
  delivered: 'entregado',
  read: 'leido',
  failed: 'fallido',
  deleted: 'eliminado',
};

export function traducirEstadoWhatsApp(statusMeta: string): string {
  return TRADUCCION_ESTADO[statusMeta] ?? statusMeta;
}

/** El nombre es lo único que WhatsApp exige por contacto — sin él no hay
 * forma útil de mostrarlo, se descarta esa entrada en vez de guardar un
 * contacto sin nombre. */
function extraerContactos(
  contactos: ContactoMetaCrudo[] | undefined,
): ContactoMensaje[] {
  const resultado: ContactoMensaje[] = [];
  for (const c of contactos ?? []) {
    const nombre = c.name?.formatted_name;
    if (!nombre) continue;
    resultado.push({
      nombre,
      telefonos: (c.phones ?? [])
        .filter(
          (p): p is { phone: string; type?: string; wa_id?: string } =>
            !!p.phone,
        )
        .map((p) => ({ numero: p.phone, tipo: p.type })),
      organizacion: c.org?.company,
    });
  }
  return resultado;
}

export function extraerEventosWhatsApp(payload: WhatsappWebhookPayload): {
  mensajes: EventoMensajeWhatsApp[];
  estados: EventoEstadoWhatsApp[];
  reacciones: EventoReaccionWhatsApp[];
  ediciones: EventoEdicionWhatsApp[];
} {
  const mensajes: EventoMensajeWhatsApp[] = [];
  const estados: EventoEstadoWhatsApp[] = [];
  const reacciones: EventoReaccionWhatsApp[] = [];
  const ediciones: EventoEdicionWhatsApp[] = [];

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

        // Una reacción no es un mensaje de chat nuevo — es metadata que se
        // pega sobre un mensaje NUESTRO ya existente (reaction.message_id).
        // Va a un array aparte, no a `mensajes`.
        if (mensaje.type === 'reaction') {
          if (mensaje.reaction?.message_id) {
            reacciones.push({
              phoneNumberId,
              wamidObjetivo: mensaje.reaction.message_id,
              emoji: mensaje.reaction.emoji ?? '',
            });
          }
          continue;
        }

        // Tampoco es un mensaje nuevo — es una edición de un mensaje que el
        // contacto ya nos había mandado. WhatsApp solo permite editar el
        // texto o el caption de un archivo, nunca el archivo en sí.
        if (mensaje.type === 'edit') {
          const original = mensaje.edit?.original_message_id;
          const editado = mensaje.edit?.message;
          if (original && editado) {
            const mediaEditada =
              editado.image ??
              editado.video ??
              editado.document ??
              editado.sticker;
            ediciones.push({
              phoneNumberId,
              wamidOriginal: original,
              texto: editado.text?.body,
              mediaCaption: mediaEditada?.caption,
              fechaEdicion: timestampADate(mensaje.timestamp),
            });
          }
          continue;
        }

        const objetoMedia =
          mensaje.image ??
          mensaje.video ??
          mensaje.audio ??
          mensaje.document ??
          mensaje.sticker;
        // Tocar un botón o elegir una opción de lista SÍ es un mensaje de
        // chat nuevo (a diferencia de reaccionar o editar) — solo que su
        // "texto" no viene en mensaje.text sino en el título elegido. Se
        // reusa toda la tubería normal de mensajes con esto resuelto acá,
        // en vez de agregar un array aparte y duplicar registrarMensaje/
        // notificaciones/etc. para un caso que en el fondo es un mensaje más.
        const textoInteractivo =
          mensaje.interactive?.type === 'button_reply'
            ? mensaje.interactive.button_reply?.title
            : mensaje.interactive?.type === 'list_reply'
              ? [
                  mensaje.interactive.list_reply?.title,
                  mensaje.interactive.list_reply?.description,
                ]
                  .filter(Boolean)
                  .join(' — ')
              : undefined;
        mensajes.push({
          phoneNumberId,
          waId: mensaje.from,
          nombreContacto: contactoPorWaId.get(mensaje.from),
          wamid: mensaje.id,
          timestamp: timestampADate(mensaje.timestamp),
          tipo:
            mensaje.type === 'interactive'
              ? (mensaje.interactive?.type ?? 'interactive')
              : (mensaje.type ?? 'unknown'),
          texto: mensaje.text?.body ?? textoInteractivo,
          respondeAWamid: mensaje.context?.id,
          ubicacion:
            mensaje.location?.latitude !== undefined &&
            mensaje.location?.longitude !== undefined
              ? {
                  latitud: mensaje.location.latitude,
                  longitud: mensaje.location.longitude,
                  nombre: mensaje.location.name,
                  direccion: mensaje.location.address,
                }
              : undefined,
          contactos:
            mensaje.type === 'contacts'
              ? extraerContactos(mensaje.contacts)
              : undefined,
          media:
            objetoMedia?.id !== undefined
              ? {
                  mediaId: objetoMedia.id,
                  mimeType: objetoMedia.mime_type,
                  caption: objetoMedia.caption,
                  nombreArchivo: mensaje.document?.filename,
                  esVoz: mensaje.audio?.voice,
                }
              : undefined,
          raw: mensaje,
        });
      }

      for (const status of value?.statuses ?? []) {
        if (!status.id || !status.status) continue;
        estados.push({
          phoneNumberId,
          wamid: status.id,
          status: traducirEstadoWhatsApp(status.status),
          timestamp: timestampADate(status.timestamp),
        });
      }
    }
  }

  return { mensajes, estados, reacciones, ediciones };
}
