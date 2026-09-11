import { Logger } from '@nestjs/common';
import { extraerContenidoMensajeMeta } from './extraer-contenido-mensaje-meta';

const logger = new Logger('WhatsappWebhookPayload');

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
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: {
          wa_id?: string;
          /** Business-scoped user ID (Meta usernames / BSUID). */
          user_id?: string;
          profile?: { name?: string; username?: string };
        }[];
        messages?: MensajeMetaCrudo[];
        /** Coexistencia: mensajes enviados desde la app WhatsApp Business
         * (celular / dispositivo vinculado). El contacto es `to`, no `from`.
         * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/smb_message_echoes */
        message_echoes?: EcoMensajeMetaCrudo[];
        statuses?: {
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
          recipient_user_id?: string;
        }[];
        /**
         * Coexistencia: sync de historial (hasta ~180 días).
         * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/history
         */
        history?: Array<{
          metadata?: {
            phase?: number;
            chunk_order?: number;
            progress?: number;
          };
          errors?: {
            code?: number;
            title?: string;
            message?: string;
            error_data?: { details?: string };
          }[];
          threads?: Array<{
            id?: string;
            context?: {
              wa_id?: string;
              user_id?: string;
              username?: string;
            };
            messages?: MensajeMetaCrudo[];
          }>;
        }>;
      };
    }[];
  }[];
}

/** Forma común de un mensaje en webhooks `messages` / `smb_message_echoes`. */
export interface MensajeMetaCrudo {
  from?: string;
  /** BSUID del contacto (Meta usernames) — presente aunque falte `from`. */
  from_user_id?: string;
  to?: string;
  to_user_id?: string;
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
    /** Respuesta de WhatsApp Flow. */
    nfm_reply?: {
      name?: string;
      body?: string;
      response_json?: string;
    };
  };
  /**
   * Quick reply / botón de plantilla (type === 'button', distinto de interactive).
   * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
   */
  button?: { text?: string; payload?: string };
  order?: {
    catalog_id?: string;
    text?: string;
    product_items?: { product_retailer_id?: string; quantity?: number }[];
  };
  system?: { body?: string; type?: string };
  unsupported?: { type?: string };
  errors?: {
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }[];
  /** Click-to-WhatsApp / anuncio — puede acompañar text/image/etc. */
  referral?: {
    source_type?: string;
    headline?: string;
    body?: string;
    source_url?: string;
  };
  /** Solo type === 'revoke' en ecos (mensaje borrado desde la app Business). */
  revoke?: { original_message_id?: string };
}

export interface EcoMensajeMetaCrudo extends MensajeMetaCrudo {
  /** Teléfono del contacto (cliente) — en ecos `from` es el negocio. */
  to?: string;
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
  /** Teléfono sin '+' — null si Meta omitió wa_id (username privacy). */
  waId: string | null;
  /** Business-scoped user ID — identidad estable cuando no hay teléfono. */
  bsuid: string | null;
  username?: string | null;
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

/** wa_id de Meta / teléfono en ecos suele venir con o sin '+'. */
function normalizarWaId(valor: string): string {
  return valor.replace(/\D/g, '');
}

type AcumuladoresEventos = {
  mensajes: EventoMensajeWhatsApp[];
  ecos: EventoMensajeWhatsApp[];
  estados: EventoEstadoWhatsApp[];
  reacciones: EventoReaccionWhatsApp[];
  ediciones: EventoEdicionWhatsApp[];
};

/** Clasifica un mensaje Meta crudo (entrante o eco) en el acumulador correcto.
 * `destino` = 'mensajes' (cliente → negocio) o 'ecos' (negocio app → cliente). */
function clasificarMensajeMeta(
  phoneNumberId: string,
  mensaje: MensajeMetaCrudo,
  identidad: {
    waId: string | null;
    bsuid: string | null;
    username?: string | null;
    nombreContacto?: string;
  },
  destino: 'mensajes' | 'ecos',
  out: AcumuladoresEventos,
): void {
  if (!mensaje.id) return;
  if (!identidad.waId && !identidad.bsuid) return;

  if (mensaje.type === 'reaction') {
    if (mensaje.reaction?.message_id) {
      out.reacciones.push({
        phoneNumberId,
        wamidObjetivo: mensaje.reaction.message_id,
        emoji: mensaje.reaction.emoji ?? '',
      });
    }
    return;
  }

  if (mensaje.type === 'edit') {
    const original = mensaje.edit?.original_message_id;
    const editado = mensaje.edit?.message;
    if (original && editado) {
      const mediaEditada =
        editado.image ?? editado.video ?? editado.document ?? editado.sticker;
      out.ediciones.push({
        phoneNumberId,
        wamidOriginal: original,
        texto: editado.text?.body,
        mediaCaption: mediaEditada?.caption,
        fechaEdicion: timestampADate(mensaje.timestamp),
      });
    }
    return;
  }

  if (mensaje.type === 'revoke') {
    const original = mensaje.revoke?.original_message_id;
    if (original) {
      out.estados.push({
        phoneNumberId,
        wamid: original,
        status: 'eliminado',
        timestamp: timestampADate(mensaje.timestamp),
      });
    }
    return;
  }

  const objetoMedia =
    mensaje.image ??
    mensaje.video ??
    mensaje.audio ??
    mensaje.document ??
    mensaje.sticker;
  // Texto/tipo según docs Meta (text, button, interactive, nfm_reply,
  // captions, unsupported, …) — no solo text.body.
  const contenido = extraerContenidoMensajeMeta(mensaje);

  const evento: EventoMensajeWhatsApp = {
    phoneNumberId,
    waId: identidad.waId,
    bsuid: identidad.bsuid,
    username: identidad.username ?? null,
    nombreContacto: identidad.nombreContacto,
    wamid: mensaje.id,
    timestamp: timestampADate(mensaje.timestamp),
    tipo: contenido.tipo,
    texto: contenido.texto ?? undefined,
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
  };

  out[destino].push(evento);
}

type ContactoWebhookMeta = {
  wa_id?: string;
  user_id?: string;
  profile?: { name?: string; username?: string };
};

function resolverIdentidadEntrante(
  mensaje: MensajeMetaCrudo,
  contacts: ContactoWebhookMeta[],
): {
  waId: string | null;
  bsuid: string | null;
  username: string | null;
  nombreContacto?: string;
} {
  const bsuid =
    mensaje.from_user_id?.trim() ||
    contacts.find((c) => c.user_id)?.user_id?.trim() ||
    null;

  const waCrudo =
    mensaje.from?.trim() ||
    contacts.find((c) => c.wa_id)?.wa_id?.trim() ||
    null;
  const waId = waCrudo ? normalizarWaId(waCrudo) || waCrudo : null;

  const perfil =
    contacts.find((c) =>
      bsuid ? c.user_id === bsuid : waCrudo ? c.wa_id === waCrudo : false,
    ) ?? contacts[0];

  return {
    waId: waId && waId.length > 0 ? waId : null,
    bsuid,
    username: perfil?.profile?.username?.trim() || null,
    nombreContacto: perfil?.profile?.name?.trim() || undefined,
  };
}

type ThreadHistorialMeta = {
  id?: string;
  context?: { wa_id?: string; user_id?: string; username?: string };
};

/**
 * Historial de coexistencia: `to`/`to_user_id` marca eco explícito.
 * Sin `to`, Meta suele omitirlo en mensajes del negocio — se compara `from`
 * con el contacto del thread (id / context) para no clasificar ecos como
 * entrantes.
 */
function resolverHistorialThread(
  mensaje: MensajeMetaCrudo,
  thread: ThreadHistorialMeta,
): {
  destino: 'mensajes' | 'ecos';
  identidad: {
    waId: string | null;
    bsuid: string | null;
    username: string | null;
    nombreContacto?: string;
  };
} | null {
  const username = thread.context?.username?.trim() || null;
  const contactoWaCrudo =
    thread.context?.wa_id?.trim() || thread.id?.trim() || null;
  const contactoWa = contactoWaCrudo
    ? normalizarWaId(contactoWaCrudo) || contactoWaCrudo
    : null;
  const contactoBsuid = thread.context?.user_id?.trim() || null;

  if (mensaje.to || mensaje.to_user_id) {
    const waId = mensaje.to
      ? normalizarWaId(mensaje.to) || mensaje.to
      : contactoWa;
    const bsuid = mensaje.to_user_id?.trim() || contactoBsuid;
    if (!waId && !bsuid) return null;
    return {
      destino: 'ecos',
      identidad: { waId: waId || null, bsuid, username },
    };
  }

  const fromWa = mensaje.from
    ? normalizarWaId(mensaje.from) || mensaje.from
    : null;
  const fromBsuid = mensaje.from_user_id?.trim() || null;

  const fromEsContacto =
    (fromWa && contactoWa && fromWa === contactoWa) ||
    (fromBsuid && contactoBsuid && fromBsuid === contactoBsuid);

  if (fromEsContacto) {
    return {
      destino: 'mensajes',
      identidad: {
        waId: fromWa || contactoWa,
        bsuid: fromBsuid || contactoBsuid,
        username,
      },
    };
  }

  // `from` es el negocio (o no matchea el thread) → eco; identidad = contacto.
  if (contactoWa || contactoBsuid) {
    if (fromWa || fromBsuid) {
      return {
        destino: 'ecos',
        identidad: {
          waId: contactoWa,
          bsuid: contactoBsuid,
          username,
        },
      };
    }
  }

  // Fallback: entrante con from o thread.context.
  const waId = fromWa || contactoWa;
  const bsuid = fromBsuid || contactoBsuid;
  if (!waId && !bsuid) return null;
  return {
    destino: 'mensajes',
    identidad: { waId, bsuid, username },
  };
}

/** Placeholder de media en sync histórico — sin asset id hasta un webhook posterior. */
function normalizarMensajeHistorial(
  mensaje: MensajeMetaCrudo,
): MensajeMetaCrudo {
  if (mensaje.type !== 'media_placeholder') return mensaje;
  return {
    ...mensaje,
    type: 'unsupported',
    text: { body: 'Media histórico no disponible' },
    unsupported: { type: 'media_placeholder' },
  };
}

function procesarMensajesCampo(
  phoneNumberId: string,
  messages: MensajeMetaCrudo[],
  contacts: ContactoWebhookMeta[],
  out: AcumuladoresEventos,
): void {
  for (const mensaje of messages) {
    const identidad = resolverIdentidadEntrante(mensaje, contacts);
    if (!identidad.waId && !identidad.bsuid) continue;
    clasificarMensajeMeta(
      phoneNumberId,
      normalizarMensajeHistorial(mensaje),
      identidad,
      'mensajes',
      out,
    );
  }
}

export function extraerEventosWhatsApp(payload: WhatsappWebhookPayload): {
  mensajes: EventoMensajeWhatsApp[];
  /** Enviados desde la app WhatsApp Business (coexistencia). */
  ecos: EventoMensajeWhatsApp[];
  estados: EventoEstadoWhatsApp[];
  reacciones: EventoReaccionWhatsApp[];
  ediciones: EventoEdicionWhatsApp[];
} {
  const out: AcumuladoresEventos = {
    mensajes: [],
    ecos: [],
    estados: [],
    reacciones: [],
    ediciones: [],
  };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const field = change.field;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (field === 'messages') {
        if (!phoneNumberId) continue;
        const contacts = value?.contacts ?? [];

        procesarMensajesCampo(
          phoneNumberId,
          value?.messages ?? [],
          contacts,
          out,
        );

        for (const status of value?.statuses ?? []) {
          if (!status.id || !status.status) continue;
          out.estados.push({
            phoneNumberId,
            wamid: status.id,
            status: traducirEstadoWhatsApp(status.status),
            timestamp: timestampADate(status.timestamp),
          });
        }
        continue;
      }

      if (field === 'smb_message_echoes') {
        if (!phoneNumberId) continue;
        for (const eco of value?.message_echoes ?? []) {
          const waId = eco.to ? normalizarWaId(eco.to) : null;
          const bsuid = eco.to_user_id?.trim() || null;
          if (!waId && !bsuid) continue;
          clasificarMensajeMeta(
            phoneNumberId,
            normalizarMensajeHistorial(eco),
            {
              waId: waId || null,
              bsuid,
              username: null,
              nombreContacto: undefined,
            },
            'ecos',
            out,
          );
        }
        continue;
      }

      if (field === 'history') {
        if (!phoneNumberId) continue;

        // Follow-up de media histórico puede llegar como `messages` bajo field=history.
        if (value?.messages?.length) {
          procesarMensajesCampo(
            phoneNumberId,
            value.messages,
            value.contacts ?? [],
            out,
          );
        }

        for (const chunk of value?.history ?? []) {
          if (chunk.errors?.length) {
            logger.log(
              `Ignorando chunk history con errores: ${chunk.errors
                .map((e) => e.code ?? e.title ?? 'desconocido')
                .join(', ')}`,
            );
            continue;
          }

          for (const thread of chunk.threads ?? []) {
            for (const mensaje of thread.messages ?? []) {
              const resuelto = resolverHistorialThread(mensaje, thread);
              if (!resuelto) continue;
              clasificarMensajeMeta(
                phoneNumberId,
                normalizarMensajeHistorial(mensaje),
                resuelto.identidad,
                resuelto.destino,
                out,
              );
            }
          }
        }
        continue;
      }

      if (field === 'smb_app_state_sync') {
        logger.log(
          'Ignorando campo webhook WhatsApp smb_app_state_sync (sync de contactos; no procesamos mensajes)',
        );
        continue;
      }

      if (field) {
        logger.warn(
          `Campo webhook WhatsApp desconocido ignorado: ${field}`,
        );
      }
    }
  }

  return out;
}
