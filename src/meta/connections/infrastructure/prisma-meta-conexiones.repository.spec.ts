import type { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { PrismaMetaConexionesRepository } from './prisma-meta-conexiones.repository';

describe('Configuration ID al actualizar credenciales Meta', () => {
  function fixture(appId: string) {
    const db = {
      metaConexion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conexion',
          appId,
          whatsappSignupConfigId: '456',
        }),
        update: jest.fn().mockResolvedValue({ id: 'conexion' }),
      },
    };
    return {
      db,
      repo: new PrismaMetaConexionesRepository(db as unknown as PrismaService),
    };
  }
  it('conserva el Configuration ID cuando se rota el secreto de la misma app', async () => {
    const { db, repo } = fixture('123');
    await repo.guardarCredencialesApp({
      organizacionId: 'org',
      appId: '123',
      appSecretCifrado: 'nuevo',
      usuarioEdicion: 'admin',
    });
    expect(db.metaConexion.update).toHaveBeenCalledWith({
      where: { id: 'conexion' },
      data: {
        appId: '123',
        appSecretCifrado: 'nuevo',
        usuarioEdicion: 'admin',
      },
    });
  });
  it('limpia el Configuration ID cuando la empresa cambia de aplicación', async () => {
    const { db, repo } = fixture('123');
    await repo.guardarCredencialesApp({
      organizacionId: 'org',
      appId: '789',
      appSecretCifrado: 'nuevo',
      usuarioEdicion: 'admin',
    });
    expect(db.metaConexion.update).toHaveBeenCalledWith({
      where: { id: 'conexion' },
      data: {
        appId: '789',
        whatsappSignupConfigId: null,
        appSecretCifrado: 'nuevo',
        usuarioEdicion: 'admin',
      },
    });
  });
});

describe('Desconexión de OAuth y vinculaciones de WhatsApp', () => {
  it('desactiva las rutas y descarta grants pendientes en la misma transacción, conservando la app', async () => {
    const tx = {
      metaConexion: { update: jest.fn() },
      whatsappConexion: { updateMany: jest.fn() },
      whatsappOnboarding: { updateMany: jest.fn() },
    };
    const db = {
      $transaction: jest
        .fn()
        .mockImplementation((fn: (value: typeof tx) => unknown) => fn(tx)),
    };
    const repo = new PrismaMetaConexionesRepository(
      db as unknown as PrismaService,
    );
    await repo.limpiarConexionOAuth('meta', 'admin');
    expect(tx.whatsappConexion.updateMany).toHaveBeenCalledWith({
      where: { metaConexionId: 'meta', estado: 1 },
      data: expect.objectContaining({
        estado: 0,
        estadoNumero: null,
        webhookSuscrito: 0,
        webhookUltimoError: null,
        callingHabilitado: 0,
      }),
    });
    expect(tx.whatsappOnboarding.updateMany).toHaveBeenCalledWith({
      where: { metaConexionId: 'meta', estado: 'TOKEN' },
      data: { estado: 'CANCELADO', tokenCifrado: '' },
    });
    const data = tx.metaConexion.update.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(data.tokenCifrado).toBeNull();
    expect(data.scopes).toBeNull();
    expect(data).not.toHaveProperty('appId');
    expect(data).not.toHaveProperty('appSecretCifrado');
    expect(data).not.toHaveProperty('whatsappSignupConfigId');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
