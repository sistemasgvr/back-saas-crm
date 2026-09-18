/**
 * Tras subir la carpeta exportada a MinIO, vincula filas en DB y borra BYTEA.
 *
 * Lee C:\Users\<user>\whatsapp-media-minio-export\manifest.jsonl
 * (o MEDIA_EXPORT_DIR). Verifica que el objeto exista en MinIO antes de
 * limpiar bytes.
 *
 *   NODE_ENV=production npx ts-node prisma/scripts/vincular-media-exportada.ts
 */
import { createInterface } from 'readline';
import { createReadStream, existsSync } from 'fs';
import { join, resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import {
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

loadEnv({
  path: resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'development'}`),
});
loadEnv({ path: resolve(process.cwd(), '.env') });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}`);
  return v.replace(/^['"]|['"]$/g, '');
}

const prisma = new PrismaClient();
const OUT_ROOT =
  process.env.MEDIA_EXPORT_DIR ||
  join(process.env.USERPROFILE || process.cwd(), 'whatsapp-media-minio-export');
const manifestPath = join(OUT_ROOT, 'manifest.jsonl');

const bucket = process.env.MINIO_BUCKET?.replace(/^['"]|['"]$/g, '') || 'crm-gvr';
const s3 = new S3Client({
  endpoint: requireEnv('MINIO_SERVER_URL'),
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: requireEnv('MINIO_ROOT_USER'),
    secretAccessKey: requireEnv('MINIO_ROOT_PASSWORD'),
  },
});

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

type Line = {
  mensajeId: string;
  organizacionId: string;
  sha256: string;
  objectKey: string;
  tamanoBytes: number;
  mimeType: string;
};

async function main() {
  if (!existsSync(manifestPath)) {
    throw new Error(`No está el manifest: ${manifestPath}`);
  }

  const rl = createInterface({
    input: createReadStream(manifestPath, 'utf8'),
    crlfDelay: Infinity,
  });

  let ok = 0;
  let skip = 0;
  let missing = 0;
  let errores = 0;
  const existsCache = new Map<string, boolean>();

  for await (const raw of rl) {
    if (!raw.trim()) continue;
    const line = JSON.parse(raw) as Line;
    try {
      const ya = await prisma.whatsappMensajeMedia.findUnique({
        where: { whatsappMensajeId: line.mensajeId },
        select: { mediaObjetoId: true, bytes: true },
      });
      if (!ya) {
        skip += 1;
        continue;
      }
      if (ya.mediaObjetoId && !ya.bytes) {
        skip += 1;
        continue;
      }

      let enMinio = existsCache.get(line.objectKey);
      if (enMinio === undefined) {
        enMinio = await objectExists(line.objectKey);
        existsCache.set(line.objectKey, enMinio);
      }
      if (!enMinio) {
        missing += 1;
        if (missing <= 5) {
          console.warn(`Falta en MinIO: ${line.objectKey}`);
        }
        continue;
      }

      let objeto = await prisma.whatsappMediaObjeto.findUnique({
        where: {
          organizacionId_sha256: {
            organizacionId: line.organizacionId,
            sha256: line.sha256,
          },
        },
      });
      if (!objeto) {
        objeto = await prisma.whatsappMediaObjeto.create({
          data: {
            organizacionId: line.organizacionId,
            sha256: line.sha256,
            objectKey: line.objectKey,
            tamanoBytes: line.tamanoBytes,
            mimeType: line.mimeType || 'application/octet-stream',
            usos: 0,
          },
        });
      }

      await prisma.$transaction([
        prisma.whatsappMensajeMedia.update({
          where: { whatsappMensajeId: line.mensajeId },
          data: { mediaObjetoId: objeto.id, bytes: null },
        }),
        prisma.whatsappMediaObjeto.update({
          where: { id: objeto.id },
          data: { usos: { increment: 1 } },
        }),
      ]);
      ok += 1;
      if (ok % 50 === 0) {
        console.log({ ok, skip, missing, errores });
      }
    } catch (e: unknown) {
      errores += 1;
      console.error(
        `Error ${line.mensajeId}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log('Vínculo terminado', { ok, skip, missing, errores });
  if (missing > 0) {
    console.log(
      'Hay objetos aún no subidos a MinIO. Sube la carpeta whatsapp/ y re-ejecuta.',
    );
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
