import { VerificarSaludWebhookWhatsappUseCase } from './verificar-salud-webhook-whatsapp.use-case';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { Logger } from '@nestjs/common';

function fixture() {
  const meta = {
    findActivaPorOrganizacion: jest
      .fn()
      .mockResolvedValue({
        appId: 'app',
        tokenCifrado: 'token',
        appSecretCifrado: 'secret',
      }),
  };
  const wa = {
    findPorId: jest
      .fn()
      .mockResolvedValue({
        id: 'line',
        wabaId: 'waba',
        phoneNumberId: 'phone',
        rolLinea: 'MENSAJES',
        callingHabilitado: false,
      }),
    obtenerUltimoMensajeEntrante: jest
      .fn()
      .mockResolvedValue(new Date('2026-09-23T15:27:09Z')),
    marcarWebhookCheck: jest.fn().mockResolvedValue(undefined),
  };
  const graph = {
    obtenerAppsSuscritasWaba: jest
      .fn()
      .mockResolvedValue([{ id: 'app', camposSuscritos: [] }]),
    obtenerSaludNumeroWhatsApp: jest
      .fn()
      .mockResolvedValue({
        status: 'CONNECTED',
        platform_type: 'CLOUD_API',
        is_on_biz_app: true,
        health_status: { can_send_message: 'AVAILABLE' },
      }),
    obtenerSuscripcionAppWhatsApp: jest
      .fn()
      .mockResolvedValue({
        activa: true,
        campos: [
          'messages',
          'history',
          'smb_message_echoes',
          'smb_app_state_sync',
        ],
      }),
  };
  const encryption = {
    decrypt: jest.fn().mockImplementation((value: string) => value),
  };
  const useCase = new VerificarSaludWebhookWhatsappUseCase(
    meta as unknown as MetaConexionesRepository,
    wa as unknown as WhatsappConexionesRepository,
    graph as unknown as MetaGraphClient,
    encryption as unknown as TokenEncryptionService,
  );
  return { useCase, meta, wa, graph };
}

describe('Salud WhatsApp: suscripción, número y entrega', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it('una app suscrita no oculta un número desconectado', async () => {
    const { useCase, graph } = fixture();
    graph.obtenerSaludNumeroWhatsApp.mockResolvedValue({
      status: 'DISCONNECTED',
    });
    const result = await useCase.execute('org', 'line', 'user');
    expect(result.webhookSuscrito).toBe(true);
    expect(result.numero.estado).toBe('DISCONNECTED');
    expect(result.ultimoMensajeEntranteEn).toBe('2026-09-23T15:27:09.000Z');
  });

  it('verifica campos en la app aunque WABA no los exponga', async () => {
    const { useCase, graph } = fixture();
    graph.obtenerSuscripcionAppWhatsApp.mockResolvedValue({
      activa: true,
      campos: ['history'],
    });
    const result = await useCase.execute('org', 'line', 'user');
    expect(result.camposVerificados).toBe(true);
    expect(result.camposFaltantes).toContain('messages');
  });

  it('una falla de red no cambia una suscripción conocida a desactivada', async () => {
    const { useCase, graph, wa } = fixture();
    graph.obtenerAppsSuscritasWaba.mockRejectedValue(new Error('timeout'));
    const result = await useCase.execute('org', 'line', 'user');
    expect(result.webhookSuscrito).toBeNull();
    expect(wa.marcarWebhookCheck).not.toHaveBeenCalled();
    expect(result.numero.estado).toBe('CONNECTED');
    expect(result.erroresVerificacion).toHaveLength(1);
  });

  it('no inventa estado ni campos cuando falla la consulta correspondiente', async () => {
    const { useCase, graph } = fixture();
    graph.obtenerSaludNumeroWhatsApp.mockRejectedValue(new Error('timeout'));
    graph.obtenerSuscripcionAppWhatsApp.mockRejectedValue(new Error('timeout'));
    const result = await useCase.execute('org', 'line', 'user');
    expect(result.numero.estado).toBeNull();
    expect(result.camposVerificados).toBe(false);
    expect(result.camposFaltantes).toEqual([]);
  });

  it('separa bloqueos de envío y no confunde errores de SIP con mensajería', async () => {
    const { useCase, graph } = fixture();
    graph.obtenerSaludNumeroWhatsApp.mockResolvedValue({
      status: 'CONNECTED',
      health_status: {
        can_send_message: 'BLOCKED',
        entities: [
          {
            can_send_message: 'BLOCKED',
            errors: [
              { error_code: 141006, error_description: 'payment' },
              { error_code: 141007, error_description: 'timezone' },
            ],
          },
          {
            can_send_message: 'AVAILABLE',
            errors: [{ error_code: 138025, error_description: 'SIP' }],
          },
        ],
      },
    });
    const result = await useCase.execute('org', 'line', 'user');
    expect(result.numero.estado).toBe('CONNECTED');
    expect(result.numero.saludEnvio).toBe('BLOCKED');
    expect(result.erroresEnvio.map((error) => error.codigo)).toEqual([
      141006, 141007,
    ]);
  });

  it('no exige campos de coexistencia en una línea Cloud sin app Business', async () => {
    const { useCase, graph } = fixture();
    graph.obtenerSaludNumeroWhatsApp.mockResolvedValue({
      status: 'CONNECTED',
      is_on_biz_app: false,
    });
    graph.obtenerSuscripcionAppWhatsApp.mockResolvedValue({
      activa: true,
      campos: ['messages'],
    });
    expect(
      (await useCase.execute('org', 'line', 'user')).camposFaltantes,
    ).toEqual([]);
  });

  it('rechaza una conexión de otra organización antes de consultar Meta', async () => {
    const { useCase, wa, graph } = fixture();
    wa.findPorId.mockResolvedValue(null);
    await expect(useCase.execute('other-org', 'line', 'user')).rejects.toThrow(
      'Conexión de WhatsApp no encontrada',
    );
    expect(wa.findPorId).toHaveBeenCalledWith('other-org', 'line');
    expect(graph.obtenerAppsSuscritasWaba).not.toHaveBeenCalled();
  });
});
