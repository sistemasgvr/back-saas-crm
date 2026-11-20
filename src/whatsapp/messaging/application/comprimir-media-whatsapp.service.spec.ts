import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { ComprimirMediaWhatsAppService } from './comprimir-media-whatsapp.service';
import {
  validarArchivoWhatsApp,
  validarTamanoCargaWhatsApp,
} from './limites-media-whatsapp';

const ejecutar = promisify(execFile);

it('acepta originales grandes y mantiene los límites finales de Meta', () => {
  expect(() =>
    validarTamanoCargaWhatsApp('video/quicktime', 80 * 1024 ** 2),
  ).not.toThrow();
  expect(() =>
    validarTamanoCargaWhatsApp('image/png', 20 * 1024 ** 2),
  ).not.toThrow();
  expect(() =>
    validarTamanoCargaWhatsApp('video/mp4', 101 * 1024 ** 2),
  ).toThrow(/original/);
  expect(() => validarTamanoCargaWhatsApp('image/png', 26 * 1024 ** 2)).toThrow(
    /original/,
  );
  expect(() => validarTamanoCargaWhatsApp('video/mp4', 0)).toThrow(/contenido/);
  expect(() =>
    validarTamanoCargaWhatsApp('audio/mpeg', 17 * 1024 ** 2),
  ).toThrow(/16 MB/);
  expect(() => validarTamanoCargaWhatsApp('application/zip', 20)).toThrow(
    /tipo/,
  );
  expect(() =>
    validarArchivoWhatsApp('video/mp4', Buffer.alloc(17 * 1024 ** 2)),
  ).toThrow(/16 MB/);
});

it('reduce una imagen grande, conserva transparencia y no agranda imágenes pequeñas', async () => {
  const service = new ComprimirMediaWhatsAppService();
  const buffer = await sharp({
    create: {
      width: 3200,
      height: 1800,
      channels: 4,
      background: { r: 80, g: 150, b: 200, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  const resultado = await service.comprimir({
    buffer,
    mimeType: 'image/png',
    nombreArchivo: 'plano.png',
  });
  expect(resultado.buffer.length).toBeLessThan(buffer.length);
  const metadata = await sharp(resultado.buffer).metadata();
  expect(metadata.width).toBe(2560);
  expect(metadata.hasAlpha).toBe(true);
  const pequeno = await service.comprimir(resultado);
  expect(pequeno.buffer.length).toBeLessThanOrEqual(resultado.buffer.length);
});

it('rechaza imágenes dañadas sin bloquear la siguiente compresión', async () => {
  const service = new ComprimirMediaWhatsAppService();
  for (let i = 0; i < 3; i++) {
    await expect(
      service.comprimir({
        buffer: Buffer.from('no es imagen'),
        mimeType: 'image/jpeg',
      }),
    ).rejects.toThrow(/No se pudo comprimir/);
  }
});

it('no transforma documentos, audios ni stickers', async () => {
  const service = new ComprimirMediaWhatsAppService();
  for (const mimeType of ['application/pdf', 'audio/ogg', 'image/webp']) {
    const input = { buffer: Buffer.from('contenido'), mimeType };
    expect(await service.comprimir(input)).toBe(input);
  }
});

it('comprime un video real de más de 16 MB a MP4 H.264/AAC sin recortar duración', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'crm-test-video-'));
  try {
    const origen = join(carpeta, 'original.avi');
    // Un segundo sin compresión: 640 × 360 × 3 × 30 > 16 MiB.
    await ejecutar(
      ffmpegPath!,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=640x360:rate=30',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=44100',
        '-t',
        '1',
        '-c:v',
        'rawvideo',
        '-pix_fmt',
        'bgr24',
        '-c:a',
        'pcm_s16le',
        origen,
      ],
      { windowsHide: true },
    );
    const buffer = await readFile(origen);
    expect(buffer.length).toBeGreaterThan(16 * 1024 ** 2);
    const service = new ComprimirMediaWhatsAppService();
    const resultado = await service.comprimir({
      buffer,
      mimeType: 'video/x-msvideo',
      nombreArchivo: 'recorrido.avi',
    });
    expect(resultado.buffer.length).toBeLessThan(16 * 1024 ** 2);
    expect(resultado.mimeType).toBe('video/mp4');
    expect(resultado.nombreArchivo).toBe('recorrido.mp4');
    // El MP4 se inspecciona y decodifica completo desde disco (incluye audio).
    const destino = join(carpeta, 'resultado.mp4');
    await writeFile(destino, resultado.buffer);
    const info = await ejecutar(
      ffmpegPath!,
      ['-hide_banner', '-i', destino, '-f', 'null', '-'],
      { windowsHide: true },
    );
    expect(info.stderr).toMatch(/Duration: 00:00:01\.00/);
    expect(info.stderr).toMatch(/Video: h264/);
    expect(info.stderr).toMatch(/Audio: aac/);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}, 30_000);
