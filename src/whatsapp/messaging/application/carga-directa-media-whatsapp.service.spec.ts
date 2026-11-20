import { ConfigService } from '@nestjs/config';
import { MinioObjectStorage } from '../../../shared/infrastructure/minio-object-storage';
import type { ObjectStorage } from '../../../shared/application/ports/object-storage.port';
import { CargaDirectaMediaWhatsAppService } from './carga-directa-media-whatsapp.service';
import type { EnviarMediaWhatsAppUseCase } from './use-cases/enviar-media-whatsapp.use-case';

const ctx = { usuarioId: 'asesor', rol: 'USUARIO' as const };
const metadata = {
  mimeType: 'video/mp4',
  tamanoBytes: Math.ceil(20.1 * 1024 ** 2),
};

it('firma el PUT con el tamaño, MIME y la condición que impide sobrescribir', async () => {
  const storage = new MinioObjectStorage(
    new ConfigService({
      MINIO_SERVER_URL: 'https://storage.test',
      MINIO_ROOT_USER: 'synthetic-user',
      MINIO_ROOT_PASSWORD: 'synthetic-password',
      MINIO_BUCKET: 'prueba',
    }),
  );
  const url = new URL(
    await storage.firmarPut(
      'tmp-whatsapp/prueba',
      'video/mp4',
      metadata.tamanoBytes,
      1200,
    ),
  );
  expect(url.pathname).toBe('/prueba/tmp-whatsapp/prueba');
  expect(url.searchParams.get('X-Amz-Expires')).toBe('1200');
  expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
    'content-length;content-type;host;if-none-match',
  );
  expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false);
});

it('envía el archivo completo una sola vez y retira los bytes temporales', async () => {
  const buffer = Buffer.alloc(metadata.tamanoBytes);
  const storage = {
    firmarPut: jest.fn().mockResolvedValue('https://storage.test/signed'),
    crearMarca: jest.fn().mockResolvedValueOnce(true).mockResolvedValue(false),
    getBuffer: jest.fn().mockResolvedValue(buffer),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const enviar = {
    autorizarConversacion: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CargaDirectaMediaWhatsAppService(
    storage as unknown as ObjectStorage,
    enviar as unknown as EnviarMediaWhatsAppUseCase,
    new ConfigService({ JWT_ACCESS_SECRET: 'synthetic-secret' }),
  );
  const { cargaId } = await service.preparar('org', 'chat', metadata, ctx);
  const key = `tmp-whatsapp/org/chat/asesor/${cargaId.split('.')[0]}`;
  expect(enviar.autorizarConversacion).toHaveBeenCalledWith('org', 'chat', ctx);
  expect(storage.firmarPut).toHaveBeenCalledWith(
    key,
    'video/mp4',
    buffer.length,
    1200,
  );
  const input = {
    ...metadata,
    cargaId,
    nombreArchivo: 'recorrido.mp4',
    caption: 'Cita',
  };
  await expect(
    service.confirmar('org', 'otro-chat', input, ctx),
  ).rejects.toThrow(/no es válida/);
  await expect(
    service.confirmar('org', 'chat', { ...input, tamanoBytes: 9 }, ctx),
  ).rejects.toThrow(/no es válida/);
  expect(storage.crearMarca).not.toHaveBeenCalled();
  await service.confirmar('org', 'chat', input, ctx);
  await expect(service.confirmar('org', 'chat', input, ctx)).rejects.toThrow(
    /ya se procesó/,
  );
  expect(enviar.execute).toHaveBeenCalledTimes(1);
  expect(enviar.execute).toHaveBeenCalledWith(
    'org',
    'chat',
    { ...input, buffer },
    ctx,
  );
  expect(storage.delete).toHaveBeenCalledWith(key);
});
