/**
 * Backfill: whatsapp_mensajes_media.bytes → MinIO (bucket crm-gvr).
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register prisma/scripts/migrar-media-minio.ts
 *
 * Requiere DATABASE_URL + MINIO_* en el entorno (.env.development / .env).
 * Reanudable: solo procesa filas con bytes IS NOT NULL y media_objeto_id IS NULL.
 * Lotes de 5 ids; dentro del lote, un archivo a la vez (máx. ~100 MB en RAM).
 *
 * Al terminar:
 *   psql "$DATABASE_URL" -f prisma/scripts/drop-bytes-despues-backfill.sql
 *   VACUUM FULL whatsapp_mensajes_media;
 */

import { createHash } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const LOTE = Number(process.env.MEDIA_MIGRATE_LOTE || 1);

loadEnv({ path: resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'development'}`) });
loadEnv({ path: resolve(process.cwd(), '.env') });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno ${name}`);
  return v.replace(/^['"]|['"]$/g, '');
}

const prisma = new PrismaClient();

const endpoint = requireEnv('MINIO_SERVER_URL');
const bucket = process.env.MINIO_BUCKET?.replace(/^['"]|['"]$/g, '') || 'crm-gvr';
const s3 = new S3Client({
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: requireEnv('MINIO_ROOT_USER'),
    secretAccessKey: requireEnv('MINIO_ROOT_PASSWORD'),
  },
});

async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    console.log(`Creando bucket ${bucket}…`);
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

async function procesarFila(mensajeId: string): Promise<{
  subido: boolean;
  reutilizado: boolean;
  bytes: number;
}> {
  const fila = await prisma.whatsappMensajeMedia.findUnique({
    where: { whatsappMensajeId: mensajeId },
    include: {
      whatsappMensaje: {
        select: {
          organizacionId: true,
          mediaMimeType: true,
          mediaTamanoBytes: true,
        },
      },
    },
  });

  if (!fila?.bytes || fila.mediaObjetoId || !fila.whatsappMensaje) {
    return { subido: false, reutilizado: false, bytes: 0 };
  }

  const organizacionId = fila.whatsappMensaje.organizacionId;
  const buffer = Buffer.from(fila.bytes);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const objectKey = `whatsapp/${organizacionId}/${sha256}`;
  const mimeType =
    fila.whatsappMensaje.mediaMimeType ?? 'application/octet-stream';
  const tamanoBytes = buffer.length;

  let objeto = await prisma.whatsappMediaObjeto.findUnique({
    where: { organizacionId_sha256: { organizacionId, sha256 } },
  });

  let subido = false;
  let reutilizado = false;

  if (objeto) {
    reutilizado = true;
  } else {
    if (!(await objectExists(objectKey))) {
      await putObject(objectKey, buffer, mimeType);
      subido = true;
    } else {
      reutilizado = true;
    }
    try {
      objeto = await prisma.whatsappMediaObjeto.create({
        data: {
          organizacionId,
          sha256,
          objectKey,
          tamanoBytes,
          mimeType,
          usos: 0,
        },
      });
    } catch {
      objeto = await prisma.whatsappMediaObjeto.findUniqueOrThrow({
        where: { organizacionId_sha256: { organizacionId, sha256 } },
      });
      reutilizado = true;
      subido = false;
    }
  }

  await prisma.$transaction([
    prisma.whatsappMensajeMedia.update({
      where: { whatsappMensajeId: mensajeId },
      data: {
        mediaObjetoId: objeto.id,
        bytes: null,
      },
    }),
    prisma.whatsappMediaObjeto.update({
      where: { id: objeto.id },
      data: { usos: { increment: 1 } },
    }),
  ]);

  return { subido, reutilizado, bytes: tamanoBytes };
}

async function main(): Promise<void> {
  await ensureBucket();

  let ultimoId = '';
  let procesadas = 0;
  let subidas = 0;
  let reutilizadas = 0;
  let bytesSubidos = 0;
  let errores = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ids = await prisma.whatsappMensajeMedia.findMany({
      where: {
        bytes: { not: null },
        mediaObjetoId: null,
        ...(ultimoId ? { whatsappMensajeId: { gt: ultimoId } } : {}),
      },
      select: { whatsappMensajeId: true },
      orderBy: { whatsappMensajeId: 'asc' },
      take: LOTE,
    });

    if (ids.length === 0) break;

    for (const { whatsappMensajeId } of ids) {
      ultimoId = whatsappMensajeId;
      try {
        const r = await procesarFila(whatsappMensajeId);
        procesadas += 1;
        if (r.subido) {
          subidas += 1;
          bytesSubidos += r.bytes;
        }
        if (r.reutilizado) reutilizadas += 1;
      } catch (error: unknown) {
        errores += 1;
        console.error(
          `Error en ${whatsappMensajeId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log(
      JSON.stringify({
        lote: ids.length,
        procesadas,
        subidas,
        reutilizadas,
        errores,
        mbSubidos: Math.round((bytesSubidos / (1024 * 1024)) * 100) / 100,
        ultimoId,
      }),
    );
  }

  console.log('Backfill terminado.', {
    procesadas,
    subidas,
    reutilizadas,
    errores,
    mbSubidos: Math.round((bytesSubidos / (1024 * 1024)) * 100) / 100,
  });

  if (errores > 0) {
    process.exitCode = 1;
    console.error(
      'Hubo errores. Re-ejecuta el script para reintentar filas pendientes.',
    );
  } else {
    console.log(
      'Siguiente paso: psql "$DATABASE_URL" -f prisma/scripts/drop-bytes-despues-backfill.sql',
    );
    console.log('Luego: VACUUM FULL whatsapp_mensajes_media;');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
