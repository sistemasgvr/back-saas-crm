import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MetaWebhooksController } from './meta-webhooks.controller';

describe('Webhook WhatsApp: aislamiento de mensajes y llamadas', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  function fixture() {
    const verificar = { verificarFirma: jest.fn().mockResolvedValue(true) };
    const mensaje = {
      execute: jest.fn().mockResolvedValue({ procesado: true }),
    };
    const llamada = { execute: jest.fn().mockResolvedValue(undefined) };
    const other = { execute: jest.fn().mockResolvedValue(undefined) };
    const dependencies = [
      new ConfigService({ META_WEBHOOK_URL_TOKEN: 'url-token' }),
      verificar,
      other,
      other,
      other,
      mensaje,
      other,
      other,
      other,
      other,
      llamada,
    ];
    const controller = new MetaWebhooksController(
      ...(dependencies as ConstructorParameters<typeof MetaWebhooksController>),
    );
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            {
              field: 'calls',
              value: {
                metadata: { phone_number_id: 'phone' },
                calls: [
                  {
                    id: 'call',
                    event: 'connect',
                    from: '51900000001',
                    timestamp: '1790866800',
                  },
                ],
              },
            },
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone' },
                messages: [
                  {
                    id: 'wamid.test',
                    from: '51900000001',
                    type: 'text',
                    text: { body: 'Prueba' },
                    timestamp: '1790866800',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const req = {
      body,
      rawBody: Buffer.from(JSON.stringify(body)),
    } as RawBodyRequest<Request>;
    return { controller, res, req, verificar, mensaje, llamada };
  }

  it('procesa mensajes de v26 aunque el campo calls aparezca primero', async () => {
    const { controller, res, req, mensaje, llamada } = fixture();
    await controller.receive(
      'url-token',
      'signature',
      req,
      res as unknown as Response,
    );
    expect(mensaje.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumberId: 'phone',
        wamid: 'wamid.test',
        texto: 'Prueba',
      }),
    );
    expect(llamada.execute).toHaveBeenCalledTimes(1);
    expect(mensaje.execute.mock.invocationCallOrder[0]).toBeLessThan(
      llamada.execute.mock.invocationCallOrder[0],
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('mensajes=1'));
    const logs = JSON.stringify((Logger.prototype.log as jest.Mock).mock.calls);
    expect(logs).not.toContain('url-token');
    expect(logs).not.toContain('Prueba');
  });

  it('una falla de llamadas no impide procesar mensajes; solicita reintento', async () => {
    const { controller, res, req, mensaje, llamada } = fixture();
    llamada.execute.mockRejectedValue(
      new Error('Fallo transitorio de llamadas'),
    );
    await controller.receive(
      'url-token',
      'signature',
      req,
      res as unknown as Response,
    );
    expect(mensaje.execute).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('rechaza firmas inválidas antes de procesar mensajes', async () => {
    const { controller, res, req, mensaje, verificar } = fixture();
    verificar.verificarFirma.mockResolvedValue(false);
    await controller.receive(
      'url-token',
      'signature',
      req,
      res as unknown as Response,
    );
    expect(mensaje.execute).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
