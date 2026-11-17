import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../../shared/application/ports/object-storage.port';
import { validarTamanoDeclaradoWhatsApp } from './limites-media-whatsapp';
import {
  EnviarMediaWhatsAppUseCase,
  type ContextoEnvioMedia,
  type EnviarMediaInput,
} from './use-cases/enviar-media-whatsapp.use-case';

const VIGENCIA_CARGA_SEGUNDOS = 20 * 60;

@Injectable()
export class CargaDirectaMediaWhatsAppService {
  private readonly logger = new Logger(CargaDirectaMediaWhatsAppService.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly enviar: EnviarMediaWhatsAppUseCase,
    private readonly config: ConfigService,
  ) {}

  async preparar(
    organizacionId: string,
    conversacionId: string,
    input: { mimeType: string; tamanoBytes: number },
    ctx: ContextoEnvioMedia,
  ) {
    validarTamanoDeclaradoWhatsApp(input.mimeType, input.tamanoBytes);
    await this.enviar.autorizarConversacion(
      organizacionId,
      conversacionId,
      ctx,
    );
    const id = `${Date.now()}-${randomUUID()}`;
    const key = this.clave(organizacionId, conversacionId, ctx.usuarioId, id);
    const firma = this.firmarCarga(key, input.mimeType, input.tamanoBytes);
    const url = await this.storage.firmarPut(
      key,
      input.mimeType,
      input.tamanoBytes,
      VIGENCIA_CARGA_SEGUNDOS,
    );
    return { cargaId: `${id}.${firma.toString('hex')}`, url };
  }

  async confirmar(
    organizacionId: string,
    conversacionId: string,
    input: Omit<EnviarMediaInput, 'buffer'> & {
      cargaId: string;
      tamanoBytes: number;
    },
    ctx: ContextoEnvioMedia,
  ): Promise<void> {
    const [id, firmaHex = ''] = input.cargaId.split('.');
    const key = this.clave(organizacionId, conversacionId, ctx.usuarioId, id);
    const firma = Buffer.from(firmaHex, 'hex');
    const esperada = this.firmarCarga(key, input.mimeType, input.tamanoBytes);
    if (firma.length !== esperada.length || !timingSafeEqual(firma, esperada)) {
      throw new BadRequestException(
        'La autorización de carga no es válida. Vuelve a seleccionar el archivo.',
      );
    }
    if (Date.now() - Number(id.slice(0, 13)) > VIGENCIA_CARGA_SEGUNDOS * 1000) {
      throw new BadRequestException(
        'Venció la carga del archivo. Vuelve a seleccionarlo.',
      );
    }
    validarTamanoDeclaradoWhatsApp(input.mimeType, input.tamanoBytes);
    // La creación condicional impide confirmar dos veces la misma carga.
    if (!(await this.storage.crearMarca(`${key}.envio`))) {
      throw new ConflictException(
        'Esta carga ya se procesó o está en curso. Revisa el chat.',
      );
    }
    try {
      const buffer = await this.storage
        .getBuffer(key)
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'NoSuchKey') {
            throw new BadRequestException(
              'La carga del archivo está incompleta. Vuelve a seleccionarlo.',
            );
          }
          throw error;
        });
      if (buffer.length !== input.tamanoBytes) {
        throw new BadRequestException(
          'El tamaño del archivo cargado no coincide. Vuelve a seleccionarlo.',
        );
      }
      await this.enviar.execute(
        organizacionId,
        conversacionId,
        { ...input, buffer },
        ctx,
      );
    } finally {
      await this.storage.delete(key).catch(() => {
        this.logger.warn('No se pudo borrar una carga temporal de WhatsApp');
      });
    }
  }

  private clave(
    organizacionId: string,
    conversacionId: string,
    usuarioId: string,
    cargaId: string,
  ): string {
    return `tmp-whatsapp/${organizacionId}/${conversacionId}/${usuarioId}/${cargaId}`;
  }

  private firmarCarga(
    key: string,
    mimeType: string,
    tamanoBytes: number,
  ): Buffer {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    )
      .update(
        JSON.stringify(['whatsapp-carga-directa', key, mimeType, tamanoBytes]),
      )
      .digest();
  }
}
