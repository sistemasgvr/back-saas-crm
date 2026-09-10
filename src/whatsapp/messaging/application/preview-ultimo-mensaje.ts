/**
 * Texto corto para la lista de chats / notificaciones.
 * Prioridad: cuerpo → caption → etiqueta por tipo (estilo WhatsApp).
 */
export function previewUltimoMensajeWhatsApp(m: {
  texto?: string | null;
  mediaCaption?: string | null;
  tipo?: string | null;
  mediaEsVoz?: boolean | null;
}): string | null {
  const texto = m.texto?.trim();
  if (texto) return texto.slice(0, 200);

  const caption = m.mediaCaption?.trim();
  if (caption) return caption.slice(0, 200);

  switch (m.tipo) {
    case 'image':
      return 'Envió una imagen';
    case 'video':
      return 'Envió un video';
    case 'audio':
      return m.mediaEsVoz ? 'Nota de voz' : 'Envió un audio';
    case 'document':
      return 'Envió un documento';
    case 'sticker':
      return 'Envió un sticker';
    case 'location':
      return 'Ubicación compartida';
    case 'contacts':
      return 'Contacto compartido';
    case 'template':
      return 'Plantilla';
    case 'interactive':
      return 'Mensaje interactivo';
    case 'button_reply':
    case 'list_reply':
      return 'Respuesta';
    default:
      return m.tipo ? 'Nuevo mensaje' : null;
  }
}

/** Truncar para título/cuerpo de notificación del SO. */
export function truncarConEllipsis(texto: string, max = 120): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
