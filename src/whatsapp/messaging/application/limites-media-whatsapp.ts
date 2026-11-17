import { BadRequestException } from '@nestjs/common';
import type { TipoMediaWhatsApp } from '../../../meta/connections/application/ports/meta-graph-client.port';

export type CategoriaMediaWhatsApp = TipoMediaWhatsApp;

interface LimiteMedia {
  nombre: string;
  maxBytes: number;
  mimesPermitidos: string[];
}

/**
 * Límites y tipos MIME reales que acepta la Media API de WhatsApp Business
 * Platform — vigente en v26 (developers.facebook.com, "Media"). Van acá y no
 * hardcodeados en cada use-case porque son la única fuente de verdad para
 * validar tanto lo que se sube (creación de mensaje) como lo que se recibe
 * (por si algún día hace falta re-chequear un webhook).
 */
export const LIMITES_MEDIA_WHATSAPP: Record<
  CategoriaMediaWhatsApp,
  LimiteMedia
> = {
  image: {
    nombre: 'imagen',
    maxBytes: 5 * 1024 * 1024,
    mimesPermitidos: ['image/jpeg', 'image/png'],
  },
  video: {
    nombre: 'video',
    maxBytes: 16 * 1024 * 1024,
    mimesPermitidos: ['video/mp4', 'video/3gpp'],
  },
  audio: {
    nombre: 'audio',
    maxBytes: 16 * 1024 * 1024,
    mimesPermitidos: [
      'audio/aac',
      'audio/mp4',
      'audio/mpeg',
      'audio/amr',
      'audio/ogg',
    ],
  },
  document: {
    nombre: 'documento',
    maxBytes: 100 * 1024 * 1024,
    mimesPermitidos: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
  },
  sticker: {
    nombre: 'sticker animado',
    maxBytes: 500 * 1024,
    mimesPermitidos: ['image/webp'],
  },
};

/** Categoría de WhatsApp a la que pertenece un mime type, o null si Meta no
 * lo acepta en ningún tipo de mensaje de media. */
export function categoriaMediaPorMimeType(
  mimeType: string,
): CategoriaMediaWhatsApp | null {
  for (const [categoria, limite] of Object.entries(LIMITES_MEDIA_WHATSAPP) as [
    CategoriaMediaWhatsApp,
    LimiteMedia,
  ][]) {
    if (limite.mimesPermitidos.includes(mimeType)) return categoria;
  }
  return null;
}

/** Valida mime type + tamaño contra los límites reales de Meta — lanza un
 * error claro en español en vez de dejar que Meta lo rechace después. */
export function validarArchivoWhatsApp(
  mimeType: string,
  archivo: Buffer,
): { categoria: CategoriaMediaWhatsApp } {
  const categoria = categoriaMediaPorMimeType(mimeType);
  if (!categoria) {
    throw new BadRequestException(
      `WhatsApp no admite este tipo de archivo (${mimeType})`,
    );
  }
  let { nombre, maxBytes } = LIMITES_MEDIA_WHATSAPP[categoria];
  if (categoria === 'sticker' && archivo.length > 100 * 1024) {
    // En un WebP animado, la cabecera VP8X tiene activo el bit de animación.
    const animado = archivo.toString('ascii', 8, 16) === 'WEBPVP8X'
      && (archivo[20] & 0x02) !== 0;
    if (!animado) {
      nombre = 'sticker estático';
      maxBytes = 100 * 1024;
    }
  }
  if (archivo.length > maxBytes) {
    const maximo = categoria === 'sticker'
      ? `${maxBytes / 1024} KB`
      : `${maxBytes / (1024 * 1024)} MB`;
    throw new BadRequestException(
      `El archivo supera el límite de WhatsApp de ${maximo} por ${nombre}. Elige un archivo más liviano.`,
    );
  }
  return { categoria };
}

/** Para preparar una carga antes de disponer de los bytes. */
export function validarTamanoDeclaradoWhatsApp(mimeType: string, tamano: number): void {
  const categoria = categoriaMediaPorMimeType(mimeType);
  if (!categoria) throw new BadRequestException(`WhatsApp no admite este tipo de archivo (${mimeType})`);
  const { nombre, maxBytes } = LIMITES_MEDIA_WHATSAPP[categoria];
  if (tamano <= 0 || !Number.isSafeInteger(tamano)) {
    throw new BadRequestException('Selecciona un archivo con contenido.');
  }
  if (tamano > maxBytes) {
    const maximo = categoria === 'sticker' ? `${maxBytes / 1024} KB` : `${maxBytes / (1024 * 1024)} MB`;
    throw new BadRequestException(
      `El archivo supera el límite de WhatsApp de ${maximo} por ${nombre}. Elige un archivo más liviano.`,
    );
  }
}
