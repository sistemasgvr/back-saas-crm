import { PrismaLeadAutoAsignacionRepository } from './prisma-lead-auto-asignacion.repository';
import type { PrismaService } from '../../shared/infrastructure/prisma.service';

function escenario(
  ids = ['u1', 'u2', 'u3'],
  limites: Record<string, number> = {},
) {
  const cfg = {
    habilitado: 1,
    usuarioIds: ids,
    usuarioPrimeroId: ids[0],
    usuarioSegundoId: ids[1] ?? ids[0],
    siguienteIndice: 0,
    limitesDiarios: limites,
    consumoDiario: {} as object,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    leadAutoAsignacionConfig: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(cfg)),
      update: jest.fn().mockImplementation(({ data }) => {
        Object.assign(cfg, data);
        return Promise.resolve(cfg);
      }),
      upsert: jest.fn().mockImplementation(({ update }) => {
        Object.assign(cfg, update);
        return Promise.resolve(cfg);
      }),
    },
    lead: {
      findFirst: jest.fn().mockResolvedValue({ id: 'lead' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    organizacionUsuario: {
      findFirst: jest.fn().mockResolvedValue({ id: 'member' }),
    },
    leadAutoAsignacionQueue: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn(),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
  };
  return {
    repo: new PrismaLeadAutoAsignacionRepository(
      prisma as unknown as PrismaService,
    ),
    tx,
    cfg,
  };
}

describe('Asignación automática con cupos diarios', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-01T17:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('mantiene el orden y salta al usuario tras sus tres leads', async () => {
    const { repo, tx } = escenario(undefined, { u2: 3 });
    const destinos: (string | null)[] = [];
    for (let i = 0; i < 13; i++)
      destinos.push(await repo.asignarLeadPendiente('org', `lead${i}`));
    expect(destinos).toEqual([
      'u1',
      'u2',
      'u3',
      'u1',
      'u2',
      'u3',
      'u1',
      'u2',
      'u3',
      'u1',
      'u3',
      'u1',
      'u3',
    ]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(13);
  });

  it('permite uno solo y deja libre el lead cuando agota el cupo', async () => {
    const { repo, tx } = escenario(['u1'], { u1: 1 });
    expect(await repo.asignarLeadPendiente('org', 'a')).toBe('u1');
    expect(await repo.asignarLeadPendiente('org', 'b')).toBeNull();
    expect(tx.lead.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.leadAutoAsignacionQueue.deleteMany).toHaveBeenLastCalledWith({
      where: { organizacionId: 'org', leadId: 'b' },
    });
  });

  it('agota todos los cupos y reinicia a las 00:00 de Lima', async () => {
    const { repo, tx } = escenario(['u1', 'u2'], { u1: 1, u2: 1 });
    jest.setSystemTime(new Date('2026-10-02T04:59:59Z'));
    expect(await repo.asignarLeadPendiente('org', 'a')).toBe('u1');
    expect(await repo.asignarLeadPendiente('org', 'b')).toBe('u2');
    expect(await repo.asignarLeadPendiente('org', 'c')).toBeNull();
    jest.setSystemTime(new Date('2026-10-02T05:00:00Z'));
    expect(await repo.asignarLeadPendiente('org', 'd')).toBe('u1');
    expect(tx.lead.updateMany).toHaveBeenCalledTimes(3);
  });

  it('no consume cupo ni avanza el cursor si otro proceso tomó el lead', async () => {
    const { repo, cfg, tx } = escenario();
    tx.lead.updateMany.mockResolvedValue({ count: 0 });
    expect(await repo.asignarLeadPendiente('org', 'a')).toBeNull();
    expect(cfg.siguienteIndice).toBe(0);
    expect(cfg.consumoDiario).toEqual({});
  });

  it('guardar cambios no restaura el cupo consumido', async () => {
    const { repo } = escenario(['u1'], { u1: 1 });
    await repo.asignarLeadPendiente('org', 'a');
    await repo.actualizarConfig({
      organizacionId: 'org',
      habilitado: true,
      usuarioIds: ['u1'],
      limitesDiarios: { u1: 1 },
    });
    expect(await repo.asignarLeadPendiente('org', 'b')).toBeNull();
  });

  it('la cola aplica los mismos cupos y no asigna sobrantes al día siguiente', async () => {
    const { repo, tx } = escenario(['u1'], { u1: 1 });
    tx.leadAutoAsignacionQueue.findFirst
      .mockResolvedValueOnce({ leadId: 'a' })
      .mockResolvedValueOnce({ leadId: 'b' })
      .mockResolvedValue(null);
    await repo.procesarCola('org');
    expect(tx.lead.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.leadAutoAsignacionQueue.deleteMany).toHaveBeenCalledTimes(2);
  });
});
