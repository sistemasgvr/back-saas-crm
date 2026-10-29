import { Logger } from '@nestjs/common';
import { VincularNumeroUseCase } from './vincular-numero.use-case';

function fixture() {
  const meta = {
    findActivaPorOrganizacion: jest
      .fn()
      .mockResolvedValue({ id: 'meta', tokenCifrado: 'token' }),
  };
  const wa = {
    findPorPhoneNumberId: jest.fn().mockResolvedValue(null),
    vincular: jest.fn().mockResolvedValue({ id: 'line' }),
    marcarWebhookSuscrito: jest.fn(),
    findPorId: jest
      .fn()
      .mockResolvedValue({ id: 'line', estadoNumero: 'CONNECTED' }),
  };
  const graph = {
    listarNumerosWhatsApp: jest.fn().mockResolvedValue([
      {
        wabaId: 'waba',
        phoneNumberId: 'phone',
        displayPhoneNumber: '+51900000000',
        verifiedName: 'Actual en Meta',
      },
    ]),
    obtenerSaludNumeroWhatsApp: jest.fn().mockResolvedValue({
      status: 'CONNECTED',
      platform_type: 'CLOUD_API',
      is_on_biz_app: true,
    }),
    suscribirWabaWebhook: jest.fn().mockResolvedValue(undefined),
  };
  const service = new VincularNumeroUseCase(
    ...([
      meta,
      wa,
      graph,
      { decrypt: (value: string) => value },
    ] as unknown as ConstructorParameters<typeof VincularNumeroUseCase>),
  );
  const link = () =>
    service.execute(
      'org',
      'waba',
      'phone',
      'número viejo',
      'nombre viejo',
      'admin',
    );
  return { meta, wa, graph, link };
}

describe('Vincular un número desde la página', () => {
  it('guarda el estado vivo y los datos de Meta, no los del selector antiguo', async () => {
    const f = fixture();
    await f.link();
    expect(f.wa.vincular).toHaveBeenCalledWith(
      expect.objectContaining({
        organizacionId: 'org',
        metaConexionId: 'meta',
        wabaId: 'waba',
        phoneNumberId: 'phone',
        estadoNumero: 'CONNECTED',
        numeroDisplay: '+51900000000',
        nombreVerificado: 'Actual en Meta',
      }),
    );
    expect(f.wa.marcarWebhookSuscrito).toHaveBeenCalledWith('line', 'admin');
  });
  it.each([
    {
      status: 'DISCONNECTED',
      platform_type: 'ON_PREMISE',
      is_on_biz_app: true,
    },
    { status: 'CONNECTED', platform_type: 'ON_PREMISE', is_on_biz_app: true },
    { status: 'PENDING', platform_type: 'CLOUD_API', is_on_biz_app: false },
    {},
  ])(
    'permite el vínculo directo y la suscripción sin ocultar el estado remoto: %j',
    async (salud) => {
      const f = fixture();
      f.graph.obtenerSaludNumeroWhatsApp.mockResolvedValue(salud);
      await f.link();
      expect(f.wa.vincular).toHaveBeenCalledWith(
        expect.objectContaining({ estadoNumero: salud.status }),
      );
      expect(f.graph.suscribirWabaWebhook).toHaveBeenCalledWith(
        'waba',
        'token',
      );
      expect(f.wa.marcarWebhookSuscrito).toHaveBeenCalledWith('line', 'admin');
    },
  );
  it('rechaza una pareja WABA/número que ya no pertenece al acceso de la empresa', async () => {
    const f = fixture();
    f.graph.listarNumerosWhatsApp.mockResolvedValue([
      { wabaId: 'otro', phoneNumberId: 'phone' },
    ]);
    await expect(f.link()).rejects.toThrow('ya no está disponible');
    expect(f.wa.vincular).not.toHaveBeenCalled();
  });
  it('no reasigna un número activo de otra empresa', async () => {
    const f = fixture();
    f.wa.findPorPhoneNumberId.mockResolvedValue({ organizacionId: 'otra' });
    await expect(f.link()).rejects.toThrow('otra organización');
    expect(f.wa.vincular).not.toHaveBeenCalled();
  });
  it('un fallo del diagnóstico no impide vincular un número cuyo acceso ya se comprobó', async () => {
    const f = fixture();
    f.graph.obtenerSaludNumeroWhatsApp.mockRejectedValue(
      new Error('Permiso denegado'),
    );
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      await f.link();
      expect(f.wa.vincular).toHaveBeenCalledWith(
        expect.objectContaining({ estadoNumero: undefined }),
      );
      expect(f.graph.suscribirWabaWebhook).toHaveBeenCalledWith(
        'waba',
        'token',
      );
    } finally {
      warn.mockRestore();
    }
  });
  it('si falla la suscripción no reutiliza una marca previa de webhook suscrito', async () => {
    const f = fixture();
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    f.graph.suscribirWabaWebhook.mockRejectedValue(
      new Error('Meta no disponible'),
    );
    try {
      await f.link();
      expect(f.wa.vincular).toHaveBeenCalledTimes(1);
      expect(f.wa.marcarWebhookSuscrito).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
