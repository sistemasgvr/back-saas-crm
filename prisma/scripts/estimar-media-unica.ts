/**
 * Estima bytes ÚNICOS pendientes (SHA-256 por org) sin subir a MinIO.
 * Uso: NODE_ENV=production npx ts-node prisma/scripts/estimar-media-unica.ts
 */
import { createHash } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

loadEnv({
  path: resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'development'}`),
});
loadEnv({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();
const LOTE = 1;

async function main() {
  const vistos = new Set<string>(); // orgId:sha256
  let filas = 0;
  let bytesBrutos = 0;
  let bytesUnicos = 0;
  let ultimoId = '';

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
      const fila = await prisma.whatsappMensajeMedia.findUnique({
        where: { whatsappMensajeId },
        include: {
          whatsappMensaje: { select: { organizacionId: true } },
        },
      });
      if (!fila?.bytes || !fila.whatsappMensaje) continue;

      const buffer = Buffer.from(fila.bytes);
      const sha = createHash('sha256').update(buffer).digest('hex');
      const key = `${fila.whatsappMensaje.organizacionId}:${sha}`;
      filas += 1;
      bytesBrutos += buffer.length;
      if (!vistos.has(key)) {
        vistos.add(key);
        bytesUnicos += buffer.length;
      }

      if (filas % 25 === 0) {
        console.log(
          JSON.stringify({
            filas,
            unicos: vistos.size,
            gbBrutos: +(bytesBrutos / 1e9).toFixed(2),
            gbUnicos: +(bytesUnicos / 1e9).toFixed(2),
          }),
        );
      }
    }
  }

  console.log(
    'RESULTADO',
    JSON.stringify({
      filas,
      objetosUnicos: vistos.size,
      gbBrutos: +(bytesBrutos / 1e9).toFixed(2),
      gbUnicos: +(bytesUnicos / 1e9).toFixed(2),
      mbUnicos: +(bytesUnicos / 1e6).toFixed(1),
      ahorroPct:
        bytesBrutos > 0
          ? +(((bytesBrutos - bytesUnicos) / bytesBrutos) * 100).toFixed(1)
          : 0,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
