import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { WebPushSender } from './web-push.sender';
import type { PrismaService } from '../../shared/infrastructure/prisma.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const enviar = webpush.sendNotification as jest.MockedFunction<
  typeof webpush.sendNotification
>;

function errorPush(statusCode: number, headers: Record<string, string> = {}) {
  return Object.assign(new Error(`status ${statusCode}`), {
    statusCode,
    headers,
  });
}

function fixture() {
  const prisma = {
    suscripcionPush: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'sub-1', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' },
        ]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const config = {
    get: jest.fn((clave: string) =>
      clave === 'VAPID_PUBLIC_KEY'
        ? 'pub'
        : clave === 'VAPID_PRIVATE_KEY'
          ? 'priv'
          : undefined,
    ),
  };
  const sender = new WebPushSender(
    config as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );
  sender.onModuleInit();
  return { sender, prisma };
}

const mensajeChat = {
  id: 'n1',
  tipo: 'WHATSAPP_MENSAJE',
  titulo: 'Ana',
  mensaje: 'Hola',
  payload: { whatsappConversacionId: '0f8fad5b-d9cb-469f-a165-70867728950e' },
};

describe('Web Push: entrega con reintentos', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    enviar.mockReset();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('chat: urgencia alta y topic por conversación (reemplaza avisos viejos del mismo chat)', async () => {
    const { sender } = fixture();
    enviar.mockResolvedValue({} as webpush.SendResult);
    await sender.enviarAUsuarios(['u1'], mensajeChat);
    expect(enviar.mock.calls[0][2]).toMatchObject({
      urgency: 'high',
      topic: '0f8fad5bd9cb469fa16570867728950e',
    });
  });

  it('reintenta ante una caída transitoria (5xx) y termina entregando', async () => {
    const { sender } = fixture();
    enviar
      .mockRejectedValueOnce(errorPush(503))
      .mockRejectedValueOnce(errorPush(0))
      .mockResolvedValue({} as webpush.SendResult);
    const promesa = sender.enviarAUsuarios(['u1'], mensajeChat);
    await jest.runAllTimersAsync();
    await expect(promesa).resolves.toEqual({
      attempted: 1,
      delivered: 1,
      failed: 0,
    });
    expect(enviar).toHaveBeenCalledTimes(3);
  });

  it('respeta Retry-After del servicio de push (429)', async () => {
    const { sender } = fixture();
    enviar
      .mockRejectedValueOnce(errorPush(429, { 'retry-after': '20' }))
      .mockResolvedValue({} as webpush.SendResult);
    const promesa = sender.enviarAUsuarios(['u1'], mensajeChat);
    await jest.advanceTimersByTimeAsync(19_000);
    expect(enviar).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_000);
    await promesa;
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('suscripción vencida (410): la da de baja sin reintentar', async () => {
    const { sender, prisma } = fixture();
    enviar.mockRejectedValue(errorPush(410));
    const resultado = await sender.enviarAUsuarios(['u1'], mensajeChat);
    expect(resultado.delivered).toBe(0);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(prisma.suscripcionPush.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { estado: 0 },
    });
  });

  it('se rinde tras agotar los reintentos', async () => {
    const { sender } = fixture();
    enviar.mockRejectedValue(errorPush(502));
    const promesa = sender.enviarAUsuarios(['u1'], mensajeChat);
    await jest.runAllTimersAsync();
    await expect(promesa).resolves.toMatchObject({ delivered: 0, failed: 1 });
    expect(enviar).toHaveBeenCalledTimes(4);
  });
});
