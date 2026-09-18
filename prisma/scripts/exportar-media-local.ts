/**
 * De Postgres → disco local (lotes de 5), dedup SHA-256, libera BYTEA en la BD.
 *
 * Flujo por cada mensaje con bytes:
 *   1. Hash SHA-256
 *   2. Si el archivo único no está en disco → lo escribe
 *   3. Crea/reusa WhatsappMediaObjeto
 *   4. Vincula media_objeto_id y pone bytes = NULL  ← libera Postgres
 *
 * Paths = mismas keys de MinIO: whatsapp/{orgId}/{sha256}
 * Cuando haya espacio en MinIO: sube la carpeta whatsapp/ al bucket crm-gvr.
 *
 *   NODE_ENV=production npm run media:exportar-local
 *
 * Carpeta (fuera de OneDrive):
 *   C:\Users\<user>\whatsapp-media-minio-export\
 */
import { createHash } from 'crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({
  path: resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'development'}`),
});
loadEnv({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();
const LOTE = Number(process.env.MEDIA_MIGRATE_LOTE || 5);
const OUT_ROOT =
  process.env.MEDIA_EXPORT_DIR ||
  join(process.env.USERPROFILE || process.cwd(), 'whatsapp-media-minio-export');

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function esErrorConexion(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /recovery mode|not yet accepting|closed the connection|Can't reach|P1001|P1017|timed out/i.test(
    msg,
  );
}

async function conReintento<T>(fn: () => Promise<T>, etiqueta: string): Promise<T> {
  let ultimo: unknown;
  for (let intento = 1; intento <= 8; intento++) {
    try {
      return await fn();
    } catch (e: unknown) {
      ultimo = e;
      if (!esErrorConexion(e) || intento === 8) throw e;
      const espera = Math.min(60_000, 2000 * intento * intento);
      console.warn(
        `BD ocupada (${etiqueta}), reintento ${intento}/8 en ${espera / 1000}s…`,
      );
      await sleep(espera);
    }
  }
  throw ultimo;
}

async function asegurarObjeto(input: {
  organizacionId: string;
  sha256: string;
  objectKey: string;
  tamanoBytes: number;
  mimeType: string;
}): Promise<string> {
  const existente = await prisma.whatsappMediaObjeto.findUnique({
    where: {
      organizacionId_sha256: {
        organizacionId: input.organizacionId,
        sha256: input.sha256,
      },
    },
  });
  if (existente) return existente.id;

  try {
    const creado = await prisma.whatsappMediaObjeto.create({
      data: {
        organizacionId: input.organizacionId,
        sha256: input.sha256,
        objectKey: input.objectKey,
        tamanoBytes: input.tamanoBytes,
        mimeType: input.mimeType,
        usos: 0,
      },
    });
    return creado.id;
  } catch {
    const deNuevo = await prisma.whatsappMediaObjeto.findUniqueOrThrow({
      where: {
        organizacionId_sha256: {
          organizacionId: input.organizacionId,
          sha256: input.sha256,
        },
      },
    });
    return deNuevo.id;
  }
}

async function procesarFila(mensajeId: string): Promise<{
  archivoNuevo: boolean;
  reutilizado: boolean;
  bytesLiberados: number;
}> {
  return conReintento(async () => {
    const fila = await prisma.whatsappMensajeMedia.findUnique({
      where: { whatsappMensajeId: mensajeId },
      include: {
        whatsappMensaje: {
          select: { organizacionId: true, mediaMimeType: true },
        },
      },
    });

    if (!fila?.bytes || fila.mediaObjetoId || !fila.whatsappMensaje) {
      return { archivoNuevo: false, reutilizado: false, bytesLiberados: 0 };
    }

    const buffer = Buffer.from(fila.bytes);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const organizacionId = fila.whatsappMensaje.organizacionId;
    const objectKey = `whatsapp/${organizacionId}/${sha256}`;
    const abs = join(OUT_ROOT, objectKey);
    const mimeType =
      fila.whatsappMensaje.mediaMimeType ?? 'application/octet-stream';

    let archivoNuevo = false;
    let reutilizado = false;

    if (existsSync(abs)) {
      reutilizado = true;
    } else {
      mkdirSync(join(OUT_ROOT, 'whatsapp', organizacionId), { recursive: true });
      writeFileSync(abs, buffer);
      archivoNuevo = true;
    }

    const mediaObjetoId = await asegurarObjeto({
      organizacionId,
      sha256,
      objectKey,
      tamanoBytes: buffer.length,
      mimeType,
    });

    await prisma.$transaction([
      prisma.whatsappMensajeMedia.update({
        where: { whatsappMensajeId: mensajeId },
        data: {
          mediaObjetoId,
          bytes: null,
        },
      }),
      prisma.whatsappMediaObjeto.update({
        where: { id: mediaObjetoId },
        data: { usos: { increment: 1 } },
      }),
    ]);

    return {
      archivoNuevo,
      reutilizado,
      bytesLiberados: buffer.length,
    };
  }, `fila ${mensajeId}`);
}

async function main() {
  mkdirSync(join(OUT_ROOT, 'whatsapp'), { recursive: true });
  const manifestPath = join(OUT_ROOT, 'manifest.jsonl');
  const manifest = createWriteStream(manifestPath, { flags: 'a' });

  writeFileSync(
    join(OUT_ROOT, 'README.txt'),
    [
      'Archivos exportados desde Postgres (deduplicados por SHA-256).',
      'Estructura = keys de MinIO: whatsapp/{organizacionId}/{sha256}',
      '',
      'Cuando haya espacio en MinIO, sube la carpeta "whatsapp/" al bucket crm-gvr',
      'conservando los paths (MinIO Console o: mc mirror ./whatsapp myminio/crm-gvr/whatsapp).',
      '',
      `Carpeta: ${OUT_ROOT}`,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Export + liberar BD → ${OUT_ROOT} (lotes de ${LOTE})`);

  let ultimoId = '';
  let procesadas = 0;
  let archivosNuevos = 0;
  let reutilizados = 0;
  let bytesLiberados = 0;
  let errores = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ids = await conReintento(
      () =>
        prisma.whatsappMensajeMedia.findMany({
          where: {
            bytes: { not: null },
            mediaObjetoId: null,
            ...(ultimoId ? { whatsappMensajeId: { gt: ultimoId } } : {}),
          },
          select: { whatsappMensajeId: true },
          orderBy: { whatsappMensajeId: 'asc' },
          take: LOTE,
        }),
      'listar lote',
    );
    if (ids.length === 0) break;

    for (const { whatsappMensajeId } of ids) {
      ultimoId = whatsappMensajeId;
      try {
        const r = await procesarFila(whatsappMensajeId);
        if (r.bytesLiberados === 0) continue;
        procesadas += 1;
        bytesLiberados += r.bytesLiberados;
        if (r.archivoNuevo) archivosNuevos += 1;
        if (r.reutilizado) reutilizados += 1;
        manifest.write(
          `${JSON.stringify({
            mensajeId: whatsappMensajeId,
            archivoNuevo: r.archivoNuevo,
            bytesLiberados: r.bytesLiberados,
          })}\n`,
        );
      } catch (e: unknown) {
        errores += 1;
        console.error(
          `Error ${whatsappMensajeId}:`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    console.log(
      JSON.stringify({
        lote: ids.length,
        procesadas,
        archivosNuevos,
        reutilizados,
        errores,
        mbLiberadosBd: Math.round((bytesLiberados / (1024 * 1024)) * 10) / 10,
        ultimoId,
      }),
    );
    // Pausa breve para no tumbar Postgres con BYTEA grandes.
    await sleep(500);
  }

  manifest.end();
  console.log('Listo', {
    procesadas,
    archivosNuevos,
    reutilizados,
    errores,
    gbLiberadosBd: Math.round((bytesLiberados / (1024 * 1024 * 1024)) * 100) / 100,
    carpeta: OUT_ROOT,
  });
  console.log(
    'Nota: los chats no mostrarán media hasta que subas la carpeta whatsapp/ a MinIO.',
  );
  console.log(
    'Para devolver disco en Postgres (EasyPanel): VACUUM FULL whatsapp_mensajes_media;',
  );
  if (errores > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
