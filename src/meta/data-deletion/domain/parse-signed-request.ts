import { createHmac, timingSafeEqual } from 'crypto';

export interface SignedRequestPayload {
  algorithm: string;
  issued_at?: number;
  user_id: string;
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

/**
 * Valida el `signed_request` de Meta (Data Deletion / Deauthorize).
 * @see https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): SignedRequestPayload | null {
  const partes = signedRequest.split('.', 2);
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;

  const [encodedSig, payload] = partes;
  let sig: Buffer;
  let data: SignedRequestPayload;
  try {
    sig = base64UrlDecode(encodedSig);
    data = JSON.parse(base64UrlDecode(payload).toString('utf8')) as SignedRequestPayload;
  } catch {
    return null;
  }

  if (!data?.user_id || typeof data.user_id !== 'string') return null;
  if ((data.algorithm ?? '').toUpperCase() !== 'HMAC-SHA256') return null;

  const expected = createHmac('sha256', appSecret).update(payload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null;
  }

  return data;
}
