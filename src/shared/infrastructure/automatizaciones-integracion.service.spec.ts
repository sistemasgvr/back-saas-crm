import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { PrismaService } from './prisma.service';
import { TokenEncryptionService } from './token-encryption.service';
import { AutomatizacionesIntegracionService } from './automatizaciones-integracion.service';

function fixture() {
  let stored: {
    webhookUrl: string;
    headerNombre: string;
    secretoCifrado: string | null;
    version: number;
    actualizadoEn: Date;
  } | null = null;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    usuario: {
      findFirst: jest.fn().mockResolvedValue({ esAdminPlataforma: 1 }),
    },
    automatizacionIntegracion: {
      findUnique: jest.fn().mockImplementation(() => stored),
      upsert: jest
        .fn()
        .mockImplementation(
          ({ create }: { create: NonNullable<typeof stored> }) => {
            stored = { ...create, actualizadoEn: new Date() };
            return stored;
          },
        ),
    },
    automatizacionIntegracionEvento: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
  } as unknown as PrismaService;
  const crypto = new TokenEncryptionService(
    new ConfigService({
      META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    }),
  );
  const service = new AutomatizacionesIntegracionService(prisma, crypto);
  return { service, tx, crypto, stored: () => stored };
}
const input = {
  webhookUrl: 'https://n8n.example.invalid/webhook/crm',
  headerNombre: 'X-CRM-Secret',
  version: 0,
  secreto: 'secreto-sintetico-para-prueba',
};
describe('Configuración central de n8n', () => {
  it('cifra el secreto, audita sin copiarlo y no lo devuelve al navegador', async () => {
    const f = fixture();
    const result = await f.service.guardar('admin', input);
    expect(f.stored()?.secretoCifrado).not.toBe(input.secreto);
    expect(f.crypto.decrypt(f.stored()!.secretoCifrado!)).toBe(input.secreto);
    expect(result).not.toHaveProperty('secreto');
    expect(result).not.toHaveProperty('secretoCifrado');
    expect(f.tx.automatizacionIntegracionEvento.create).toHaveBeenCalledWith({
      data: { version: 1, usuarioId: 'admin', secretoAccion: 'REEMPLAZADO' },
    });
  });
  it('omitir secreto conserva el valor cifrado al editar URL', async () => {
    const f = fixture();
    await f.service.guardar('admin', input);
    const encrypted = f.stored()?.secretoCifrado;
    await f.service.guardar('admin', {
      ...input,
      webhookUrl: 'https://n8n.example.invalid/webhook/otro',
      version: 1,
      secreto: undefined,
    });
    expect(f.stored()?.secretoCifrado).toBe(encrypted);
  });
  it('elimina el secreto solamente mediante una acción explícita', async () => {
    const f = fixture();
    await f.service.guardar('admin', input);
    await f.service.guardar('admin', {
      ...input,
      version: 1,
      secreto: undefined,
      eliminarSecreto: true,
    });
    expect(f.stored()?.secretoCifrado).toBeNull();
    expect((await f.service.obtener()).credencialConfigurada).toBe(false);
  });
  it('una versión obsoleta no sobrescribe el secreto', async () => {
    const f = fixture();
    await f.service.guardar('admin', input);
    await expect(
      f.service.guardar('admin', {
        ...input,
        secreto: 'otro-secreto-sintetico',
      }),
    ).rejects.toThrow(ConflictException);
    expect(f.tx.automatizacionIntegracion.upsert).toHaveBeenCalledTimes(1);
  });
  it('revalida administrador activo dentro de la transacción', async () => {
    const f = fixture();
    f.tx.usuario.findFirst.mockResolvedValue(null);
    await expect(f.service.guardar('tenant', input)).rejects.toThrow(
      ForbiddenException,
    );
    expect(f.tx.automatizacionIntegracion.upsert).not.toHaveBeenCalled();
  });
  it.each([
    'file:///secret',
    'https://user:password@n8n.example.invalid/hook',
    'https://n8n.example.invalid/hook?token=secret',
    'https://n8n.example.invalid/hook#secret',
  ])('rechaza URL inválida o con secretos: %s', async (webhookUrl) => {
    await expect(
      fixture().service.guardar('admin', { ...input, webhookUrl }),
    ).rejects.toThrow(BadRequestException);
  });
  it('no permite inyectar cabeceras ni eliminar y reemplazar a la vez', async () => {
    const f = fixture();
    await expect(
      f.service.guardar('admin', { ...input, headerNombre: 'X-Test\r\nHost' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      f.service.guardar('admin', { ...input, eliminarSecreto: true }),
    ).rejects.toThrow(BadRequestException);
  });
  it('configurada no significa que el motor esté operativo; tenant recibe solo metadatos', async () => {
    const f = fixture();
    await f.service.guardar('admin', input);
    const state = await f.service.estado();
    expect(state).toMatchObject({ configurada: true, operativa: false });
    expect(state).not.toHaveProperty('webhookUrl');
    expect(state).not.toHaveProperty('secretoCifrado');
  });
});
