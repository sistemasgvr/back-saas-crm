import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../shared/infrastructure/prisma.service';
import { WhatsappBotAdminService } from './whatsapp-bot-admin.service';

function fixture() {
  type Config = {
    habilitado: boolean;
    version: number;
    actualizadoPor: string;
    actualizadoEn: Date;
  };
  const configs = new Map<string, Config>();
  let admin = true;
  let existe = true;
  let activo = true;
  let modulo = true;
  let pendientes = 0;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    usuario: {
      findFirst: jest
        .fn()
        .mockImplementation(() => (admin ? { id: 'platform' } : null)),
    },
    organizacion: {
      findUnique: jest
        .fn()
        .mockImplementation(() => (existe ? { estado: activo ? 1 : 0 } : null)),
    },
    organizacionModulo: {
      findFirst: jest
        .fn()
        .mockImplementation(() => (modulo ? { id: 'whatsapp' } : null)),
    },
    whatsappSalidaIntento: {
      count: jest.fn().mockImplementation(() => pendientes),
    },
    whatsappConversacion: { updateMany: jest.fn(), update: jest.fn() },
    whatsappBotConfiguracion: {
      findUnique: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { organizacionId: string } }) =>
            configs.get(where.organizacionId) ?? null,
        ),
      upsert: jest
        .fn()
        .mockImplementation(
          ({
            where,
            create,
            update,
          }: {
            where: { organizacionId: string };
            create: Config;
            update: Omit<Config, 'version'>;
          }) => {
            const anterior = configs.get(where.organizacionId);
            const config = anterior
              ? { ...update, version: anterior.version + 1 }
              : create;
            configs.set(where.organizacionId, config);
            return config;
          },
        ),
    },
    whatsappBotConfiguracionEvento: {
      count: jest.fn(async () => 0),
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  let cola = Promise.resolve();
  const prisma = {
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => {
      const run = cola.then(() => fn(tx));
      cola = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  } as unknown as PrismaService;
  const service = new WhatsappBotAdminService(prisma);
  const cambiar = (habilitado: boolean, configVersion: number, org = 'org-a') =>
    service.actualizar(org, 'platform', {
      habilitado,
      configVersion,
      motivo: 'Cambio del piloto',
    });
  return {
    service,
    cambiar,
    configs,
    tx,
    revocar: () => {
      admin = false;
    },
    inexistente: () => {
      existe = false;
    },
    desactivarOrg: () => {
      activo = false;
    },
    desactivarModulo: () => {
      modulo = false;
    },
    enCurso: () => {
      pendientes = 1;
    },
  };
}

describe('Administración del bot por organización', () => {
  it('queda deshabilitado sin configuración y acepta administradores sin membresía tenant', async () => {
    const f = fixture();
    await expect(f.service.obtener('org-a', 'platform')).resolves.toMatchObject(
      { habilitado: false, configVersion: 0 },
    );
    await expect(f.cambiar(true, 0)).resolves.toMatchObject({
      habilitado: true,
      configVersion: 1,
    });
    expect(f.tx.usuario.findFirst).toHaveBeenCalledWith({
      where: { id: 'platform', estado: 1, esAdminPlataforma: 1 },
    });
    expect(f.tx.whatsappBotConfiguracionEvento.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matcher in assertion
      data: expect.objectContaining({
        usuarioId: 'platform',
        organizacionId: 'org-a',
        version: 1,
        habilitadoAnterior: false,
        habilitadoNuevo: true,
      }),
    });
  });
  it('revalida permisos para lectura, escritura e historial', async () => {
    const f = fixture();
    f.revocar();
    await expect(f.service.obtener('org-a', 'platform')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(f.cambiar(true, 0)).rejects.toThrow(ForbiddenException);
    await expect(f.service.historial('org-a', 'platform')).rejects.toThrow(
      ForbiddenException,
    );
    expect(f.tx.whatsappBotConfiguracion.upsert).not.toHaveBeenCalled();
  });
  it('rechaza organizaciones inexistentes', async () => {
    const f = fixture();
    f.inexistente();
    await expect(f.cambiar(true, 0)).rejects.toThrow(NotFoundException);
  });
  it('resuelve solicitudes concurrentes con conflicto y evita doble auditoría', async () => {
    const f = fixture();
    const resultados = await Promise.allSettled([
      f.cambiar(true, 0),
      f.cambiar(true, 0),
    ]);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    await expect(f.cambiar(false, 0)).rejects.toThrow(ConflictException);
    await f.cambiar(true, 1);
    expect(f.tx.whatsappBotConfiguracionEvento.create).toHaveBeenCalledTimes(1);
  });
  it('aísla organizaciones y nunca modifica control humano al desactivar/reactivar', async () => {
    const f = fixture();
    await f.cambiar(true, 0);
    await f.cambiar(true, 0, 'org-b');
    await f.cambiar(false, 1);
    await f.cambiar(true, 2);
    expect(f.configs.get('org-a')?.version).toBe(3);
    expect(f.configs.get('org-b')?.version).toBe(1);
    expect(f.tx.whatsappConversacion.update).not.toHaveBeenCalled();
    expect(f.tx.whatsappConversacion.updateMany).not.toHaveBeenCalled();
  });
  it('informa envíos previos en curso y bloquea reactivación mientras duren', async () => {
    const f = fixture();
    await f.cambiar(true, 0);
    f.enCurso();
    await expect(f.cambiar(false, 1)).resolves.toMatchObject({
      habilitado: false,
      desactivacionPendiente: true,
      despachosEnCurso: 1,
    });
    await expect(f.cambiar(true, 2)).rejects.toThrow(ConflictException);
  });
  it.each(['organizacion', 'modulo'])(
    'exige %s activa para habilitar y permite desactivar',
    async (tipo) => {
      const f = fixture();
      await f.cambiar(true, 0);
      if (tipo === 'organizacion') f.desactivarOrg();
      else f.desactivarModulo();
      await f.cambiar(false, 1);
      await expect(f.cambiar(true, 2)).rejects.toThrow(ConflictException);
    },
  );
  it('consulta el historial únicamente de la organización solicitada', async () => {
    const f = fixture();
    f.tx.whatsappBotConfiguracionEvento.count.mockResolvedValue(105);
    const result = await f.service.historial('org-b', 'platform', 6, 20);
    expect(result).toMatchObject({
      total: 105,
      page: 6,
      pageSize: 20,
      totalPages: 6,
    });
    expect(f.tx.whatsappBotConfiguracionEvento.findMany).toHaveBeenCalledWith({
      where: { organizacionId: 'org-b' },
      orderBy: { version: 'desc' },
      skip: 100,
      take: 20,
    });
  });
});
