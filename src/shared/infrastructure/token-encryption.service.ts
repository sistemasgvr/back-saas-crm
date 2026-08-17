import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Cifra secretos en reposo (tokens de Meta, PLAN.md §3.6). Formato de salida:
 * "<iv>.<authTag>.<ciphertext>" en base64, para poder reconstruir el
 * decipher sin guardar nada adicional en columnas separadas.
 */
@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('META_TOKEN_ENCRYPTION_KEY');
    this.key = Buffer.from(raw, 'base64');
    if (this.key.length !== KEY_LENGTH) {
      throw new Error(
        `META_TOKEN_ENCRYPTION_KEY debe decodificar (base64) a ${KEY_LENGTH} bytes para AES-256-GCM`,
      );
    }
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((buf) => buf.toString('base64')).join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, ciphertextB64] = payload.split('.');
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new Error('Formato de payload cifrado inválido');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
