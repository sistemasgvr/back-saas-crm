import type { AutomatizacionesIntegracionService } from '../../../shared/infrastructure/automatizaciones-integracion.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { BotEmpresaService } from './bot-empresa.service';
import { ConfigService } from '@nestjs/config';

function fixture(clientesHabilitados = true) {
  const config = {
    habilitado: true,
    modoInicial: 'HUMANO',
    preferenciasVersion: 0,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    organizacionUsuario: {
      findFirst: jest.fn().mockResolvedValue({ rol: 'PROPIETARIO' }),
    },
    organizacionModulo: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { modulo: { codigo: 'WHATSAPP' } },
          { modulo: { codigo: 'AUTOMATIZACIONES' } },
        ]),
    },
    whatsappBotConfiguracion: {
      findUnique: jest.fn().mockResolvedValue(config),
      upsert: jest
        .fn()
        .mockImplementation(
          ({ update }: { update: { modoInicial: string } }) => {
            config.modoInicial = update.modoInicial;
            config.preferenciasVersion++;
            return { ...config };
          },
        ),
    },
    whatsappBotPreferenciaEvento: { create: jest.fn().mockResolvedValue({}) },
    whatsappConversacion: { updateMany: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const service = new BotEmpresaService(
    prisma,
    {
      estado: () =>
        Promise.resolve({
          proveedor: 'n8n',
          estado: 'PENDIENTE_ORQUESTACION',
          configurada: true,
          operativa: false,
          alcance: 'PLATAFORMA',
        }),
    } as AutomatizacionesIntegracionService,
    new ConfigService({
      AUTOMATIZACIONES_CLIENTES_HABILITADAS: clientesHabilitados,
    }),
  );
  return { service, tx, config };
}

describe('Preferencias de atención por empresa', () => {
  it('el cierre global bloquea el bot aun con módulos y permiso de plataforma activos', async () => {
    const f = fixture(false);
    expect(await f.service.obtener('org')).toMatchObject({
      clientesHabilitados: false,
      autorizado: false,
    });
    await expect(
      f.service.actualizar('org', 'owner', {
        modoInicial: 'BOT',
        preferenciasVersion: 0,
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(f.service.requiereBot(f.tx as never, 'org')).rejects.toThrow(
      ForbiddenException,
    );
    expect(f.tx.whatsappBotConfiguracion.upsert).not.toHaveBeenCalled();
  });
  it('credenciales presentes no anuncian una integración operativa', async () => {
    const f = fixture();
    expect(await f.service.integracion()).toMatchObject({
      configurada: true,
      operativa: false,
      alcance: 'PLATAFORMA',
    });
  });
  it('guardar BOT audita el cambio sin habilitar la empresa ni modificar chats', async () => {
    const f = fixture();
    const result = await f.service.actualizar('org', 'owner', {
      modoInicial: 'BOT',
      preferenciasVersion: 0,
    });
    expect(result).toMatchObject({
      modoInicial: 'BOT',
      preferenciasVersion: 1,
      autorizado: true,
    });
    const writes = f.tx.whatsappBotConfiguracion.upsert.mock
      .calls as unknown as Array<[{ update: Record<string, unknown> }]>;
    expect(writes[0][0].update).not.toHaveProperty('habilitado');
    expect(f.tx.whatsappConversacion.updateMany).not.toHaveBeenCalled();
    expect(f.tx.whatsappBotPreferenciaEvento.create).toHaveBeenCalledWith({
      data: {
        organizacionId: 'org',
        usuarioId: 'owner',
        version: 1,
        modoAnterior: 'HUMANO',
        modoNuevo: 'BOT',
      },
    });
  });
  it('repetir la preferencia no genera otra versión ni auditoría', async () => {
    const f = fixture();
    await f.service.actualizar('org', 'owner', {
      modoInicial: 'HUMANO',
      preferenciasVersion: 0,
    });
    expect(f.tx.whatsappBotPreferenciaEvento.create).not.toHaveBeenCalled();
  });
  it('un usuario regular no puede editar preferencias', async () => {
    const f = fixture();
    f.tx.organizacionUsuario.findFirst.mockResolvedValue({ rol: 'USUARIO' });
    await expect(
      f.service.actualizar('org', 'user', {
        modoInicial: 'BOT',
        preferenciasVersion: 0,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('rechaza membresía revocada', async () => {
    const f = fixture();
    f.tx.organizacionUsuario.findFirst.mockResolvedValue(null);
    await expect(
      f.service.actualizar('org', 'owner', {
        modoInicial: 'BOT',
        preferenciasVersion: 0,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('rechaza versión obsoleta sin escribir', async () => {
    const f = fixture();
    await expect(
      f.service.actualizar('org', 'owner', {
        modoInicial: 'BOT',
        preferenciasVersion: 1,
      }),
    ).rejects.toThrow(ConflictException);
    expect(f.tx.whatsappBotConfiguracion.upsert).not.toHaveBeenCalled();
  });
  it('Automatizaciones inactivo bloquea BOT aunque plataforma permita el bot', async () => {
    const f = fixture();
    f.tx.organizacionModulo.findMany.mockResolvedValue([
      { modulo: { codigo: 'WHATSAPP' } },
    ]);
    await expect(
      f.service.actualizar('org', 'owner', {
        modoInicial: 'BOT',
        preferenciasVersion: 0,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('el cliente no puede concederse el permiso de plataforma', async () => {
    const f = fixture();
    f.config.habilitado = false;
    await expect(
      f.service.actualizar('org', 'owner', {
        modoInicial: 'BOT',
        preferenciasVersion: 0,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('permite volver a humano aunque la plataforma retire el permiso', async () => {
    const f = fixture();
    f.config.habilitado = false;
    f.config.modoInicial = 'BOT';
    expect(
      await f.service.actualizar('org', 'owner', {
        modoInicial: 'HUMANO',
        preferenciasVersion: 0,
      }),
    ).toMatchObject({ modoInicial: 'HUMANO', autorizado: false });
  });
  it('no asigna ni despacha bot sin motor operativo', async () => {
    const f = fixture();
    await expect(
      f.service.requiereBot(
        f.tx as unknown as Parameters<BotEmpresaService['requiereBot']>[0],
        'org',
      ),
    ).rejects.toThrow(ConflictException);
  });
  it('la lectura de preferencias queda limitada a la organización indicada', async () => {
    const f = fixture();
    await f.service.obtener('org-b');
    expect(f.tx.whatsappBotConfiguracion.findUnique).toHaveBeenCalledWith({
      where: { organizacionId: 'org-b' },
    });
    const reads = f.tx.organizacionModulo.findMany.mock
      .calls as unknown as Array<[{ where: { organizacionId: string } }]>;
    expect(reads[0][0].where.organizacionId).toBe('org-b');
  });
});
