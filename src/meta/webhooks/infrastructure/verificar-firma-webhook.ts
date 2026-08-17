import { createHmac, timingSafeEqual } from 'crypto';

const PREFIJO = 'sha256=';

/**
 * Verifica el header X-Hub-Signature-256 de Meta: HMAC-SHA256 del body crudo
 * (bytes exactos, antes de parsear JSON) con el App Secret (PLAN.md §8.2).
 */
export function verificarFirmaWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith(PREFIJO)) {
    return false;
  }

  const esperada = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const recibida = signatureHeader.slice(PREFIJO.length);

  const bufEsperada = Buffer.from(esperada, 'hex');
  const bufRecibida = Buffer.from(recibida, 'hex');
  if (bufEsperada.length !== bufRecibida.length) {
    return false;
  }

  return timingSafeEqual(bufEsperada, bufRecibida);
}
