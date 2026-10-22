import { Logger } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { ProcesarMensajeWhatsAppEntranteUseCase } from './procesar-mensaje-whatsapp-entrante.use-case';
import {
  MediaPendienteError,
  MediaWebhookWhatsAppService,
} from '../media-webhook-whatsapp.service';
import { excepcionDesdeErrorMeta } from '../../../../meta/connections/application/mapear-error-meta-graph';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import type { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import type { AsegurarLeadParaConversacionWhatsAppUseCase } from './asegurar-lead-para-conversacion-whatsapp.use-case';
import type { ControlAtencionService } from '../control-atencion.service';
import type { TiempoRealChatsService } from '../tiempo-real-chats.service';
import type { EventoMensajeWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import type { GuardarMediaWhatsAppService } from '../guardar-media-whatsapp.service';
import { AxiosError, AxiosHeaders } from 'axios';

const evento = (extra: Partial<EventoMensajeWhatsApp> = {}) =>
  ({
    phoneNumberId: 'phone',
    wamid: 'wamid.1',
    waId: '51900000001',
    tipo: 'image',
    texto: undefined,
    timestamp: new Date('2026-10-21T12:00:00Z'),
    media: { mediaId: 'media-1', mimeType: 'image/jpeg' },
    raw: {},
    ...extra,
  }) as unknown as EventoMensajeWhatsApp;

/** Error 4xx de Graph tal como lo deja el cliente (marcado como rechazo). */
function rechazoMeta() {
  return excepcionDesdeErrorMeta(
    new AxiosError('Not found', '404', undefined, undefined, {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { code: 100, message: 'Media not found' } },
    }),
  );
}

function fixture(opciones: { creado?: boolean; pendiente?: boolean } = {}) {
  const orden: string[] = [];
  const conexiones = {
    findPorPhoneNumberId: jest
      .fn()
      .mockResolvedValue({ id: 'linea', organizacionId: 'org' }),
  };
  const conversaciones = {
    findOCrearConversacion: jest
      .fn()
      .mockResolvedValue({ id: 'chat', esNueva: false }),
    buscarIdPorWamid: jest.fn(),
    registrarMensaje: jest.fn().mockImplementation(() => {
      orden.push('registrar');
      return Promise.resolve({ id: 'msg', creado: opciones.creado ?? true });
    }),
    actualizarTrasEntrante: jest.fn().mockResolvedValue(undefined),
    findPorId: jest.fn().mockResolvedValue({ noLeidos: 1, lead: null }),
    tieneMediaPendiente: jest
      .fn()
      .mockResolvedValue(opciones.pendiente ?? true),
    adjuntarMedia: jest.fn().mockImplementation(() => {
      orden.push('adjuntar');
      return Promise.resolve();
    }),
  };
  const notificacion = {
    execute: jest.fn().mockImplementation(() => {
      orden.push('notificar');
      return Promise.resolve({ id: 'n1' });
    }),
  };
  const tiempoReal = {
    notificar: jest.fn().mockImplementation((_o, _c, cambio: string) => {
      orden.push(`vivo:${cambio}`);
    }),
  };
  const graph = {
    descargarMediaWhatsApp: jest.fn().mockImplementation(() => {
      orden.push('descargar');
      return Promise.resolve({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
      });
    }),
  };
  const guardarMedia = {
    asegurar: jest
      .fn()
      .mockResolvedValue({ id: 'obj', mimeType: 'image/jpeg', tamanoBytes: 3 }),
  };
  const media = new MediaWebhookWhatsAppService(
    {
      findActivaPorOrganizacion: jest
        .fn()
        .mockResolvedValue({ tokenCifrado: 'tok' }),
    } as unknown as MetaConexionesRepository,
    graph as unknown as MetaGraphClient,
    { decrypt: (v: string) => v } as unknown as TokenEncryptionService,
    conversaciones as unknown as WhatsappConversacionesRepository,
    guardarMedia as unknown as GuardarMediaWhatsAppService,
    tiempoReal as unknown as TiempoRealChatsService,
  );
  const useCase = new ProcesarMensajeWhatsAppEntranteUseCase(
    conexiones as unknown as WhatsappConexionesRepository,
    conversaciones as unknown as WhatsappConversacionesRepository,
    notificacion as unknown as CrearNotificacionUseCase,
    {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as AsegurarLeadParaConversacionWhatsAppUseCase,
    {
      aplicarModoInicial: jest.fn(),
    } as unknown as ControlAtencionService,
    media,
    tiempoReal as unknown as TiempoRealChatsService,
  );
  return { useCase, orden, conversaciones, notificacion, graph, guardarMedia };
}

describe('Mensaje entrante: latencia y archivo diferido', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it('avisa en vivo y notifica ANTES de bajar el archivo de Meta', async () => {
    const { useCase, orden, conversaciones } = fixture();
    await useCase.execute(evento());
    expect(orden).toEqual([
      'registrar',
      'vivo:mensaje',
      'notificar',
      'descargar',
      'adjuntar',
      'vivo:media',
    ]);
    // El mensaje se guarda sin bytes; el archivo se vincula después.
    expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
      expect.not.objectContaining({
        mediaObjetoId: expect.anything() as unknown,
      }),
    );
  });

  it('falla transitoria al bajar el archivo: ya notificó y pide reintento a Meta', async () => {
    const { useCase, graph, notificacion } = fixture();
    graph.descargarMediaWhatsApp.mockRejectedValue(new Error('ECONNRESET'));
    await expect(useCase.execute(evento())).rejects.toBeInstanceOf(
      MediaPendienteError,
    );
    expect(notificacion.execute).toHaveBeenCalledTimes(1);
  });

  it('en el reintento de Meta solo completa el archivo, sin volver a notificar', async () => {
    const { useCase, orden, notificacion, conversaciones } = fixture({
      creado: false,
    });
    await useCase.execute(evento());
    expect(notificacion.execute).not.toHaveBeenCalled();
    expect(conversaciones.actualizarTrasEntrante).not.toHaveBeenCalled();
    expect(orden).toEqual(['registrar', 'descargar', 'adjuntar', 'vivo:media']);
  });

  it('reintento con el archivo ya guardado no vuelve a descargar', async () => {
    const { useCase, graph } = fixture({ creado: false, pendiente: false });
    await useCase.execute(evento());
    expect(graph.descargarMediaWhatsApp).not.toHaveBeenCalled();
  });

  it('si Meta rechaza el archivo (4xx) no reintenta: queda sin bytes', async () => {
    const { useCase, graph, conversaciones } = fixture();
    graph.descargarMediaWhatsApp.mockRejectedValue(rechazoMeta());
    await expect(useCase.execute(evento())).resolves.toMatchObject({
      procesado: true,
    });
    expect(conversaciones.adjuntarMedia).not.toHaveBeenCalled();
  });

  it('MinIO caído también se reintenta', async () => {
    const { useCase, guardarMedia } = fixture();
    guardarMedia.asegurar.mockRejectedValue(new BadRequestException('minio'));
    await expect(useCase.execute(evento())).rejects.toBeInstanceOf(
      MediaPendienteError,
    );
  });
});
