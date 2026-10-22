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
    const cuenta = { execute: jest.fn().mockResolvedValue(undefined) };
    const contacto = { execute: jest.fn().mockResolvedValue(true) };
    const preferencia = { execute: jest.fn().mockResolvedValue(undefined) };
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
      cuenta,
      contacto,
      preferencia,
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
    return {
      controller,
      res,
      req,
      verificar,
      mensaje,
      llamada,
      cuenta,
      contacto,
      preferencia,
    };
  }

  it('despacha campos de cuenta, contactos y preferencias sin avisos de campo desconocido', async () => {
    const { controller, res, cuenta, contacto, preferencia } = fixture();
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            { field: 'account_update', value: { event: 'ACCOUNT_OFFBOARDED' } },
            {
              field: 'smb_app_state_sync',
              value: {
                metadata: { phone_number_id: 'phone' },
                state_sync: [
                  {
                    type: 'contact',
                    action: 'add',
                    contact: {
                      full_name: 'Ana Pérez',
                      phone_number: '51900000001',
                    },
                  },
                ],
              },
            },
            {
              field: 'user_preferences',
              value: {
                metadata: { phone_number_id: 'phone' },
                user_preferences: [
                  {
                    wa_id: '51900000001',
                    category: 'marketing_messages',
                    value: 'stop',
                    timestamp: 1790866800,
                  },
                ],
              },
            },
            { field: 'flows', value: {} },
          ],
        },
      ],
    };
    const req = {
      body,
      rawBody: Buffer.from(JSON.stringify(body)),
    } as RawBodyRequest<Request>;

    await controller.receive(
      'url-token',
      'signature',
      req,
      res as unknown as Response,
    );

    expect(cuenta.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        campo: 'account_update',
        wabaId: 'waba',
        severidad: 'critica',
        cambiosLinea: { estadoNumero: 'DISCONNECTED' },
      }),
    );
    expect(contacto.execute).toHaveBeenCalledWith({
      phoneNumberId: 'phone',
      waId: '51900000001',
      nombre: 'Ana Pérez',
      accion: 'add',
    });
    expect(preferencia.execute).toHaveBeenCalledWith(
      expect.objectContaining({ waId: '51900000001', valor: 'stop' }),
    );
    const warns = JSON.stringify(
      (Logger.prototype.warn as jest.Mock).mock.calls,
    );
    expect(warns).not.toContain('desconocido');
    expect(res.status).toHaveBeenCalledWith(200);
  });

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
    const logs = JSON.stringify((Logger.prototype.log as jest.Mock).mock.calls);
    expect(logs).toContain('mensajes=1');
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
