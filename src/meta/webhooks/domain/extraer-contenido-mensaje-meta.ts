/**
 * Extracción de texto/tipo desde el payload crudo de Meta (Cloud API).
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages
 */

export interface MensajeMetaParaTexto {
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  audio?: { voice?: boolean };
  sticker?: unknown;
  location?: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  contacts?: { name?: { formatted_name?: string } }[];
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
    nfm_reply?: {
      name?: string;
      body?: string;
      response_json?: string;
    };
  };
  order?: {
    catalog_id?: string;
    text?: string;
    product_items?: { product_retailer_id?: string; quantity?: number }[];
  };
  system?: { body?: string; type?: string };
  unsupported?: { type?: string };
  errors?: { code?: number; title?: string; message?: string }[];
  referral?: {
    source_type?: string;
    headline?: string;
    body?: string;
    source_url?: string;
  };
}

export interface ContenidoMensajeMeta {
  /** Tipo normalizado para BD / UI (button_reply, list_reply, nfm_reply, …). */
  tipo: string;
  /** Texto visible; nunca vacío si Meta mandó algo interpretable. */
  texto: string | null;
}

function textoNfmReply(
  nfm: NonNullable<MensajeMetaParaTexto['interactive']>['nfm_reply'],
): string | null {
  if (!nfm) return null;
  const body = nfm.body?.trim();
  if (body && body.toLowerCase() !== 'sent') return body;

  const partes: string[] = [];
  if (nfm.name?.trim()) partes.push(`Flow: ${nfm.name.trim()}`);
  if (nfm.response_json?.trim()) {
    try {
      const parsed = JSON.parse(nfm.response_json) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (v == null || v === '') continue;
        partes.push(`${k}: ${String(v)}`);
      }
    } catch {
      partes.push(nfm.response_json.trim().slice(0, 200));
    }
  }
  if (partes.length > 0) return partes.join(' · ');
  return body || 'Respuesta de formulario';
}

function textoOrder(order: MensajeMetaParaTexto['order']): string | null {
  if (!order) return null;
  if (order.text?.trim()) return order.text.trim();
  const n = order.product_items?.length ?? 0;
  if (n > 0) return `Pedido (${n} producto${n === 1 ? '' : 's'})`;
  return 'Pedido';
}

function textoUnsupported(mensaje: MensajeMetaParaTexto): string {
  const sub = mensaje.unsupported?.type?.trim();
  const err = mensaje.errors?.[0] as
    | {
        message?: string;
        title?: string;
        error_data?: { details?: string };
      }
    | undefined;
  const detalle =
    err?.error_data?.details?.trim() ||
    err?.message?.trim() ||
    err?.title?.trim() ||
    (sub ? `tipo: ${sub}` : null);
  return detalle
    ? `Mensaje no soportado (${detalle})`
    : 'Mensaje no soportado por WhatsApp API';
}

function textoReferral(ref: MensajeMetaParaTexto['referral']): string | null {
  if (!ref) return null;
  const partes = [ref.headline, ref.body]
    .map((p) => p?.trim())
    .filter(Boolean);
  if (partes.length > 0) return partes.join(' — ');
  if (ref.source_type) return `Origen: ${ref.source_type}`;
  return null;
}

/**
 * Prioridad según docs Meta:
 * text.body → button.text → interactive.* → captions media → location/contacts/order/system → unsupported → referral.
 */
export function extraerContenidoMensajeMeta(
  mensaje: MensajeMetaParaTexto,
): ContenidoMensajeMeta {
  const typeRaw = mensaje.type?.trim() || 'unknown';

  if (typeRaw === 'interactive') {
    const sub = mensaje.interactive?.type?.trim() || 'interactive';
    if (sub === 'button_reply') {
      return {
        tipo: 'button_reply',
        texto: mensaje.interactive?.button_reply?.title?.trim() || null,
      };
    }
    if (sub === 'list_reply') {
      const titulo = mensaje.interactive?.list_reply?.title?.trim();
      const desc = mensaje.interactive?.list_reply?.description?.trim();
      return {
        tipo: 'list_reply',
        texto: [titulo, desc].filter(Boolean).join(' — ') || null,
      };
    }
    if (sub === 'nfm_reply') {
      return {
        tipo: 'nfm_reply',
        texto: textoNfmReply(mensaje.interactive?.nfm_reply),
      };
    }
    return { tipo: sub, texto: null };
  }

  // Quick reply / botón de plantilla (type === 'button', NO interactive).
  // https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
  if (typeRaw === 'button') {
    return {
      tipo: 'button',
      texto:
        mensaje.button?.text?.trim() ||
        mensaje.button?.payload?.trim() ||
        null,
    };
  }

  if (typeRaw === 'text') {
    const body = mensaje.text?.body?.trim() || null;
    const referral = !body ? textoReferral(mensaje.referral) : null;
    return { tipo: 'text', texto: body ?? referral };
  }

  if (typeRaw === 'image') {
    return {
      tipo: 'image',
      texto: mensaje.image?.caption?.trim() || null,
    };
  }
  if (typeRaw === 'video') {
    return {
      tipo: 'video',
      texto: mensaje.video?.caption?.trim() || null,
    };
  }
  if (typeRaw === 'document') {
    return {
      tipo: 'document',
      texto:
        mensaje.document?.caption?.trim() ||
        mensaje.document?.filename?.trim() ||
        null,
    };
  }
  if (typeRaw === 'audio') {
    return { tipo: 'audio', texto: null };
  }
  if (typeRaw === 'sticker') {
    return { tipo: 'sticker', texto: null };
  }

  if (typeRaw === 'location') {
    const nombre = mensaje.location?.name?.trim();
    const dir = mensaje.location?.address?.trim();
    return {
      tipo: 'location',
      texto: [nombre, dir].filter(Boolean).join(' — ') || null,
    };
  }

  if (typeRaw === 'contacts') {
    const nombres = (mensaje.contacts ?? [])
      .map((c) => c.name?.formatted_name?.trim())
      .filter(Boolean);
    return {
      tipo: 'contacts',
      texto: nombres.length > 0 ? nombres.join(', ') : null,
    };
  }

  if (typeRaw === 'order') {
    return { tipo: 'order', texto: textoOrder(mensaje.order) };
  }

  if (typeRaw === 'system') {
    return {
      tipo: 'system',
      texto: mensaje.system?.body?.trim() || 'Mensaje del sistema',
    };
  }

  if (typeRaw === 'unsupported') {
    return { tipo: 'unsupported', texto: textoUnsupported(mensaje) };
  }

  // Fallback: a veces Meta manda type raro pero trae text.body / button / interactive.
  const fallback =
    mensaje.text?.body?.trim() ||
    mensaje.button?.text?.trim() ||
    mensaje.interactive?.button_reply?.title?.trim() ||
    textoNfmReply(mensaje.interactive?.nfm_reply) ||
    textoReferral(mensaje.referral) ||
    null;

  return { tipo: typeRaw, texto: fallback };
}

/** Rehidrata texto faltante desde `datos_crudos` (mensajes ya persistidos). */
export function recuperarTextoDesdeDatosCrudos(
  datosCrudos: unknown,
): string | null {
  if (!datosCrudos || typeof datosCrudos !== 'object') return null;
  return extraerContenidoMensajeMeta(datosCrudos as MensajeMetaParaTexto)
    .texto;
}
