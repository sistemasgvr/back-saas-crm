import { GestionMembresiasService } from './gestion-membresias.service';
import { PrismaUsuariosAdminRepository } from '../../platform-admin/infrastructure/prisma-usuarios-admin.repository';

describe('Cupo al reactivar una cuenta desde SaaS', () => {
  function preparar({
    limite = 1,
    activos = 1,
    estado = 0,
    plataforma = 0,
  }: {
    limite?: number | null;
    activos?: number;
    estado?: number;
    plataforma?: number;
  } = {}) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      usuario: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve(
              where.id === 'actor'
                ? { estado: 1, esAdminPlataforma: 1 }
                : { estado, esAdminPlataforma: plataforma },
            ),
          ),
        update: jest.fn().mockResolvedValue({ id: 'usuario', estado: 1 }),
      },
      organizacionUsuario: {
        findMany: jest.fn().mockResolvedValue([{ organizacionId: 'empresa' }]),
        count: jest.fn().mockResolvedValue(activos),
      },
      organizacion: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ limiteUsuarios: limite }),
      },
    };
    const db = {
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    };
    const gestion = new GestionMembresiasService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const repo = new PrismaUsuariosAdminRepository(db as never, gestion);
    return { tx, repo };
  }

  it('bloquea la vía de administración SaaS y no modifica la cuenta', async () => {
    const { tx, repo } = preparar();
    await expect(repo.cambiarEstado('usuario', 1, 'actor')).rejects.toThrow(
      'límite',
    );
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it.each([
    { limite: 2, activos: 1 },
    { limite: null, activos: 50 },
    { limite: 1, activos: 1, estado: 1 },
    { limite: 1, activos: 1, plataforma: 1 },
  ])('permite reactivar cuando corresponde: %j', async (config) => {
    const { tx, repo } = preparar(config);
    await expect(
      repo.cambiarEstado('usuario', 1, 'actor'),
    ).resolves.toMatchObject({ id: 'usuario' });
    expect(tx.usuario.update).toHaveBeenCalledTimes(1);
  });

  it('permite desactivar aun con el límite excedido', async () => {
    const { repo, tx } = preparar({ estado: 1, activos: 5 });
    await repo.cambiarEstado('usuario', 0, 'actor');
    expect(tx.usuario.update).toHaveBeenCalledWith({
      where: { id: 'usuario' },
      data: { estado: 0, usuarioEdicion: 'actor' },
    });
  });

  it('no consume cupo una membresía desactivada durante la espera del bloqueo', async () => {
    const { tx, repo } = preparar();
    tx.organizacionUsuario.findMany
      .mockResolvedValueOnce([{ organizacionId: 'empresa' }])
      .mockResolvedValueOnce([]);
    await expect(
      repo.cambiarEstado('usuario', 1, 'actor'),
    ).resolves.toBeDefined();
    expect(tx.organizacionUsuario.count).not.toHaveBeenCalled();
  });

  it('rechaza una nueva membresía concurrente que no quedó bloqueada', async () => {
    const { tx, repo } = preparar({ limite: null });
    tx.organizacionUsuario.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ organizacionId: 'otra' }]);
    await expect(repo.cambiarEstado('usuario', 1, 'actor')).rejects.toThrow(
      'membresía cambió',
    );
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('revalida que el actor siga siendo administrador SaaS activo', async () => {
    const { tx, repo } = preparar();
    tx.usuario.findUnique.mockResolvedValueOnce({
      estado: 0,
      esAdminPlataforma: 1,
    });
    await expect(repo.cambiarEstado('usuario', 1, 'actor')).rejects.toThrow(
      'Solo plataforma',
    );
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });
});
