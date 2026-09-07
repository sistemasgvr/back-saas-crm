/**
 * Texto corto para la lista de chats / notificaciones.
 * Prioridad: cuerpo → caption → etiqueta por tipo (Imagen, Audio, …).
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
      return 'Imagen';
    case 'video':
      return 'Video';
    case 'audio':
      return m.mediaEsVoz ? 'Nota de voz' : 'Audio';
    case 'document':
      return 'Documento';
    case 'sticker':
      return 'Sticker';
    case 'location':
      return 'Ubicación';
    case 'contacts':
      return 'Contacto';
    case 'template':
      return 'Plantilla';
    case 'interactive':
      return 'Mensaje interactivo';
    case 'button_reply':
    case 'list_reply':
      return texto ?? 'Respuesta';
    default:
      return m.tipo ? 'Mensaje' : null;
  }
}
