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
