import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OBJECT_STORAGE } from '../../../shared/application/ports/object-storage.port';
import type { ObjectStorage } from '../../../shared/application/ports/object-storage.port';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';

export interface MediaObjetoAsegurado {
  id: string;
  sha256: string;
  objectKey: string;
  tamanoBytes: number;
  mimeType: string;
}

/** Persiste bytes en MinIO con dedup por organización + SHA-256.
 * No incrementa `usos` — eso lo hace `registrarMensaje` al vincular. */
@Injectable()
export class GuardarMediaWhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  objectKeyPara(organizacionId: string, sha256: string): string {
    return `whatsapp/${organizacionId}/${sha256}`;
  }

  sha256De(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async asegurar(
    organizacionId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<MediaObjetoAsegurado> {
    const sha256 = this.sha256De(buffer);
    const objectKey = this.objectKeyPara(organizacionId, sha256);
    const tamanoBytes = buffer.length;
    const mime = mimeType || 'application/octet-stream';

    const existente = await this.prisma.whatsappMediaObjeto.findUnique({
      where: {
        organizacionId_sha256: { organizacionId, sha256 },
      },
    });
    if (existente) {
      return {
        id: existente.id,
        sha256: existente.sha256,
        objectKey: existente.objectKey,
        tamanoBytes: existente.tamanoBytes,
        mimeType: existente.mimeType,
      };
    }

    const yaEnBucket = await this.storage.exists(objectKey);
    if (!yaEnBucket) {
      await this.storage.put({
        key: objectKey,
        body: buffer,
        contentType: mime,
      });
    }

    try {
      const creado = await this.prisma.whatsappMediaObjeto.create({
        data: {
          organizacionId,
          sha256,
          objectKey,
          tamanoBytes,
          mimeType: mime,
          usos: 0,
        },
      });
      return {
        id: creado.id,
        sha256: creado.sha256,
        objectKey: creado.objectKey,
        tamanoBytes: creado.tamanoBytes,
        mimeType: creado.mimeType,
      };
    } catch (error: unknown) {
      // Carrera: otro request creó la misma fila — reutilizar.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const deNuevo = await this.prisma.whatsappMediaObjeto.findUniqueOrThrow(
          {
            where: {
              organizacionId_sha256: { organizacionId, sha256 },
            },
          },
        );
        return {
          id: deNuevo.id,
          sha256: deNuevo.sha256,
          objectKey: deNuevo.objectKey,
          tamanoBytes: deNuevo.tamanoBytes,
          mimeType: deNuevo.mimeType,
        };
      }
      throw error;
    }
  }
}
