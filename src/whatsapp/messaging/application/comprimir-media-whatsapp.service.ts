import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import {
  LIMITES_MEDIA_WHATSAPP,
  validarArchivoWhatsApp,
  validarTamanoCargaWhatsApp,
} from './limites-media-whatsapp';

interface Media {
  buffer: Buffer;
  mimeType: string;
  nombreArchivo?: string;
}

// Por proceso: no dejamos una cola de buffers de 100 MB en memoria.
const MAX_PROCESOS = 2;
const TIEMPO_VIDEO_MS = 180_000;

@Injectable()
export class ComprimirMediaWhatsAppService {
  private readonly logger = new Logger(ComprimirMediaWhatsAppService.name);
  private activos = 0;

  async comprimir(input: Media): Promise<Media> {
    validarTamanoCargaWhatsApp(input.mimeType, input.buffer.length);
    const imagen = ['image/jpeg', 'image/png'].includes(input.mimeType);
    const video = input.mimeType.startsWith('video/');
    if (!imagen && !video) return input;
    if (this.activos >= MAX_PROCESOS) {
      throw new ServiceUnavailableException(
        'Hay otros archivos comprimiéndose. Intenta enviar de nuevo en un momento.',
      );
    }
    this.activos++;
    try {
      const resultado = imagen
        ? await this.comprimirImagen(input)
        : await this.comprimirVideo(input);
      validarArchivoWhatsApp(resultado.mimeType, resultado.buffer);
      return resultado;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      // No registramos rutas, nombres ni contenido de los archivos de usuarios.
      this.logger.warn('No se pudo procesar un archivo multimedia de WhatsApp');
      throw new BadRequestException(
        'No se pudo comprimir el archivo. Verifica que se pueda reproducir o abrir e intenta con otro archivo.',
      );
    } finally {
      this.activos--;
    }
  }

  private async comprimirImagen(input: Media): Promise<Media> {
    // Conservamos PNG y su transparencia; JPEG utiliza calidad visual alta.
    const base = sharp(input.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: 'inside',
        withoutEnlargement: true,
      });
    let buffer = await (
      input.mimeType === 'image/png'
        ? base.png({ compressionLevel: 9, effort: 7 })
        : base.jpeg({ quality: 85, mozjpeg: true })
    ).toBuffer();
    if (buffer.length > LIMITES_MEDIA_WHATSAPP.image.maxBytes) {
      buffer = await sharp(buffer)
        .resize({
          width: 1920,
          height: 1920,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      return {
        ...input,
        buffer,
        mimeType: 'image/jpeg',
        nombreArchivo: this.nombre(input, '.jpg'),
      };
    }
    return buffer.length < input.buffer.length ? { ...input, buffer } : input;
  }

  private async comprimirVideo(input: Media): Promise<Media> {
    const binario = process.env.FFMPEG_BIN || ffmpegPath;
    if (!binario) {
      throw new ServiceUnavailableException(
        'La compresión de videos no está disponible en este servidor.',
      );
    }
    const carpeta = await mkdtemp(join(tmpdir(), 'crm-video-'));
    try {
      const origen = join(carpeta, 'original');
      const destino = join(carpeta, 'comprimido.mp4');
      await writeFile(origen, input.buffer);
      const vence = Date.now() + TIEMPO_VIDEO_MS;
      // Sin -t ni -fs: nunca recortamos un video para hacerlo entrar.
      for (const [lado, calidad] of [
        [1280, 23],
        [960, 27],
        [640, 30],
      ]) {
        const restante = vence - Date.now();
        if (restante <= 0) throw new Error('Tiempo de compresión agotado');
        await new Promise<void>((resolve, reject) => {
          execFile(
            binario,
            [
              '-hide_banner',
              '-loglevel',
              'error',
              '-nostdin',
              '-y',
              '-protocol_whitelist',
              'file,pipe',
              '-format_whitelist',
              'mov,matroska,webm,avi',
              '-threads',
              '2',
              '-i',
              origen,
              '-map',
              '0:v:0',
              '-map',
              '0:a:0?',
              '-map_metadata',
              '-1',
              '-map_chapters',
              '-1',
              '-vf',
              `scale=w='min(${lado},iw)':h='min(${lado},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1`,
              '-c:v',
              'libx264',
              '-preset',
              'fast',
              '-crf',
              String(calidad),
              '-pix_fmt',
              'yuv420p',
              '-threads',
              '2',
              '-filter_threads',
              '1',
              '-c:a',
              'aac',
              '-b:a',
              '96k',
              '-ac',
              '2',
              '-movflags',
              '+faststart',
              destino,
            ],
            {
              timeout: restante,
              killSignal: 'SIGKILL',
              maxBuffer: 1024 * 1024,
              windowsHide: true,
            },
            (error) => {
              if (error)
                reject(
                  new Error('Falló la compresión de FFmpeg', { cause: error }),
                );
              else resolve();
            },
          );
        });
        const buffer = await readFile(destino);
        if (buffer.length <= LIMITES_MEDIA_WHATSAPP.video.maxBytes) {
          return {
            ...input,
            buffer,
            mimeType: 'video/mp4',
            nombreArchivo: this.nombre(input, '.mp4'),
          };
        }
      }
      throw new BadRequestException(
        'El video sigue superando los 16 MB después de comprimirlo. Elige un video más corto para conservar una calidad aceptable.',
      );
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }

  private nombre(input: Media, extension: string): string {
    return `${parse(input.nombreArchivo || 'archivo').name}${extension}`;
  }
}
