import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { CoexistenciaService } from './coexistencia.service';

const REDIRECT_URI =
  'https://staticxx.facebook.com/x/connect/xd_arbiter/?version=46#cb=synthetic&origin=https%3A%2F%2Fcrm.example.test';

function fixture() {
  const c = {
    id: 'meta',
    appId: '123',
    whatsappSignupConfigId: '456',
    tokenCifrado: 'oauth',
    appSecretCifrado: 'secret',
  };
  const s = {
    id: 'session',
    organizacionId: 'org',
    usuarioId: 'user',
    metaConexionId: 'meta',
    appId: '123',
    tokenCifrado: 'grant',
    expiraEn: new Date(Date.now() + 60000),
    estado: 'TOKEN',
  };
  const db = {
    metaConexion: {
      findFirst: jest.fn().mockResolvedValue(c),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    whatsappOnboarding: {
      findFirst: jest.fn().mockResolvedValue(s),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'session' }),
    },
  };
  const phone = {
    id: 'phone',
    display_phone_number: '51900000000',
    verified_name: 'Prueba',
    is_on_biz_app: true,
    platform_type: 'CLOUD_API',
    status: 'CONNECTED',
  };
  const http = {
    get: jest.fn().mockReturnValue(of({ data: { data: [phone] } })),
    post: jest
      .fn<unknown, [string, object, unknown]>()
      .mockReturnValue(of({ data: { request_id: 'request' } })),
  };
  const graph = {
    listarNumerosWhatsApp: jest
      .fn()
      .mockResolvedValue([{ wabaId: 'waba', phoneNumberId: 'phone' }]),
    obtenerSuscripcionAppWhatsApp: jest.fn().mockResolvedValue({
      activa: true,
      campos: [
        'messages',
        'account_update',
        'history',
        'smb_app_state_sync',
        'smb_message_echoes',
      ],
    }),
    suscribirWabaWebhook: jest.fn().mockResolvedValue(undefined),
  };
  const lineas = {
    findPorPhoneNumberId: jest.fn().mockResolvedValue(null),
    vincular: jest.fn().mockResolvedValue({ id: 'line' }),
    marcarWebhookSuscrito: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn(() => undefined),
  };
  const encryption = {
    decrypt: jest.fn((x: string) => x),
    encrypt: jest.fn((x: string) => 'encrypted:' + x),
  };
  const service = new CoexistenciaService(
    ...([
      db,
      config,
      encryption,
      http,
      graph,
      lineas,
    ] as unknown as ConstructorParameters<typeof CoexistenciaService>),
  );
  return { service, db, http, graph, lineas, phone, s };
}

describe('Alta de coexistencia', () => {
  it('rechaza redirects ajenos, con credenciales, sin HTTPS o con ruta distinta antes de llamar a Meta', async () => {
    const f = fixture();
    for (const uri of [
      '',
      'https://evil.test/',
      'https://facebook.com.evil.test/x/connect/xd_arbiter/',
      'http://staticxx.facebook.com/x/connect/xd_arbiter/',
      'https://user:pass@staticxx.facebook.com/x/connect/xd_arbiter/',
      'https://www.facebook.com/other',
    ]) {
      await expect(
        f.service.intercambiar('org', 'user', 'code', uri),
      ).rejects.toThrow('URI');
    }
    expect(f.http.get).not.toHaveBeenCalled();
  });
  it('intercambia el code del SDK con la URI exacta del SDK y sin Bearer de app, conservando la validación del grant', async () => {
    const f = fixture();
    f.http.get
      .mockReturnValueOnce(of({ data: { access_token: 'grant' } }))
      .mockReturnValueOnce(
        of({ data: { data: { is_valid: true, app_id: '123' } } }),
      );
    await expect(
      f.service.intercambiar('org', 'user', 'code', REDIRECT_URI),
    ).resolves.toEqual({ sessionId: 'session' });
    expect(f.http.get).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v26.0/oauth/access_token',
      {
        params: {
          client_id: '123',
          client_secret: 'secret',
          code: 'code',
          redirect_uri: REDIRECT_URI,
        },
        timeout: 10000,
      },
    );
    expect(f.http.get).toHaveBeenNthCalledWith(
      2,
      'https://graph.facebook.com/v26.0/debug_token',
      {
        params: { input_token: 'grant' },
        headers: { Authorization: 'Bearer 123|secret' },
        timeout: 10000,
      },
    );
    expect(f.db.whatsappOnboarding.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizacionId: 'org',
        usuarioId: 'user',
        tokenCifrado: 'encrypted:grant',
      }) as unknown,
    });
  });
  it('explica el mismatch del redirect sin crear sesiones ni reintentar códigos', async () => {
    const f = fixture();
    const error = new AxiosError('Request failed');
    Object.assign(error, {
      response: {
        status: 400,
        data: {
          error: {
            code: 100,
            error_subcode: 36008,
            message:
              'Error validating verification code. Please make sure your redirect_uri is identical to the one you used in the OAuth dialog request',
          },
        },
      },
    });
    f.http.get.mockReturnValue(throwError(() => error));
    await expect(
      f.service.intercambiar('org', 'user', 'code', REDIRECT_URI),
    ).rejects.toThrow('URI de redirección');
    expect(f.http.get).toHaveBeenCalledTimes(1);
    expect(f.db.whatsappOnboarding.create).not.toHaveBeenCalled();
  });
  it('lee el Configuration ID de la conexión de la empresa', async () => {
    const f = fixture();
    await expect(f.service.configuracion('org')).resolves.toEqual({
      appId: '123',
      configId: '456',
      version: 'v26.0',
    });
    expect(f.db.metaConexion.findFirst).toHaveBeenCalledWith({
      where: { organizacionId: 'org', estado: 1 },
    });
  });
  it('guarda solo para la organización y App ID vigentes, con auditoría', async () => {
    const f = fixture();
    await f.service.guardarConfiguracion(
      'org',
      'admin',
      '123',
      '98765432101234567890',
    );
    expect(f.db.metaConexion.updateMany).toHaveBeenCalledWith({
      where: { organizacionId: 'org', appId: '123', estado: 1 },
      data: {
        whatsappSignupConfigId: '98765432101234567890',
        usuarioEdicion: 'admin',
      },
    });
  });
  it('permite quitar el ID y rechaza un App ID obsoleto', async () => {
    const f = fixture();
    await expect(
      f.service.guardarConfiguracion('org', 'admin', '123', null),
    ).resolves.toEqual({ configId: null });
    f.db.metaConexion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      f.service.guardarConfiguracion('org', 'admin', '999', '456'),
    ).rejects.toThrow('cambió');
  });
  it('rechaza IDs no numéricos y mayores a 64 dígitos antes de guardar', async () => {
    const f = fixture();
    for (const value of ['abc', '1'.repeat(65), ''])
      await expect(
        f.service.guardarConfiguracion('org', 'admin', '123', value),
      ).rejects.toThrow('numéricos');
    expect(f.db.metaConexion.updateMany).not.toHaveBeenCalled();
  });
  it('descubre el número y enruta antes de solicitar historial, sin registrar ni sustituir OAuth', async () => {
    const f = fixture();
    await expect(
      f.service.completar('org', 'user', 'session', 'waba'),
    ).resolves.toEqual({ ok: true, phoneNumberId: 'phone' });
    expect(f.http.post.mock.calls.map((call) => call[0])).toEqual([
      'https://graph.facebook.com/v26.0/phone/smb_app_data',
      'https://graph.facebook.com/v26.0/phone/smb_app_data',
    ]);
    expect(f.lineas.vincular.mock.invocationCallOrder[0]).toBeLessThan(
      f.http.post.mock.invocationCallOrder[0],
    );
    expect(f.http.post.mock.calls.map((call) => call[1])).toEqual([
      { messaging_product: 'whatsapp', sync_type: 'smb_app_state_sync' },
      { messaging_product: 'whatsapp', sync_type: 'history' },
    ]);
    expect(f.db.whatsappOnboarding.update).toHaveBeenLastCalledWith({
      where: { id: 'session' },
      data: {
        historialRequestId: 'request',
        estado: 'COMPLETO',
        tokenCifrado: '',
      },
    });
  });
  it('busca la sesión por organización, usuario y aplicación', async () => {
    const f = fixture();
    f.db.whatsappOnboarding.findFirst.mockResolvedValue(null);
    await expect(
      f.service.completar('otra', 'user', 'session', 'waba'),
    ).rejects.toThrow('no pertenece');
    expect(f.db.whatsappOnboarding.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session',
        organizacionId: 'otra',
        usuarioId: 'user',
        metaConexionId: 'meta',
        appId: '123',
      },
    });
    expect(f.http.get).not.toHaveBeenCalled();
  });
  it('no suscribe un número ON_PREMISE o desconectado', async () => {
    const f = fixture();
    f.phone.platform_type = 'ON_PREMISE';
    await expect(
      f.service.completar('org', 'user', 'session', 'waba'),
    ).rejects.toThrow('Meta todavía');
    expect(f.graph.suscribirWabaWebhook).not.toHaveBeenCalled();
    expect(f.lineas.vincular).not.toHaveBeenCalled();
  });
  it('rechaza activos que el OAuth operativo no puede administrar', async () => {
    const f = fixture();
    f.graph.listarNumerosWhatsApp.mockResolvedValue([]);
    await expect(
      f.service.completar('org', 'user', 'session', 'waba'),
    ).rejects.toThrow('no es accesible');
    expect(f.http.post).not.toHaveBeenCalled();
  });
  it('rechaza números de otra organización antes de cambiar enrutamiento', async () => {
    const f = fixture();
    f.lineas.findPorPhoneNumberId.mockResolvedValue({ organizacionId: 'otra' });
    await expect(
      f.service.completar('org', 'user', 'session', 'waba'),
    ).rejects.toThrow('otra organización');
    expect(f.lineas.vincular).not.toHaveBeenCalled();
  });
  it('impide dos solicitudes concurrentes de sincronización', async () => {
    const f = fixture();
    f.db.whatsappOnboarding.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      f.service.completar('org', 'user', 'session', 'waba'),
    ).rejects.toThrow('en proceso');
    expect(f.http.post).not.toHaveBeenCalled();
  });
  it('no vuelve a sincronizar una sesión ya completada', async () => {
    const f = fixture();
    Object.assign(f.s, { estado: 'COMPLETO', phoneNumberId: 'phone' });
    await expect(
      f.service.completar('org', 'user', 'session', 'waba'),
    ).resolves.toEqual({ ok: true, phoneNumberId: 'phone' });
    expect(f.http.post).not.toHaveBeenCalled();
  });
  it('rechaza un grant emitido para otra aplicación', async () => {
    const f = fixture();
    f.http.get
      .mockReturnValueOnce(of({ data: { access_token: 'grant' } }))
      .mockReturnValueOnce(
        of({ data: { data: { is_valid: true, app_id: 'otra' } } }),
      );
    await expect(
      f.service.intercambiar('org', 'user', 'code', REDIRECT_URI),
    ).rejects.toThrow('no pertenece');
    expect(f.db.whatsappOnboarding.create).not.toHaveBeenCalled();
  });
});
