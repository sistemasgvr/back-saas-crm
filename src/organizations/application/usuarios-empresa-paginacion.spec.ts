import { GestionMembresiasService } from './gestion-membresias.service';

describe('Listado paginado de usuarios de empresa', () => {
  it('mantiene los cupos globales y usa el mismo filtro para contar y consultar', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      usuario: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ estado: 1, esAdminPlataforma: 1 }),
      },
      organizacion: {
        findUnique: jest.fn().mockResolvedValue({ estado: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ limiteUsuarios: 10 }),
      },
      organizacionUsuario: {
        count: jest.fn().mockResolvedValueOnce(105).mockResolvedValueOnce(3),
        findMany: jest.fn().mockResolvedValue([]),
      },
      lead: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new GestionMembresiasService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.listar(
      'org',
      {
        usuarioId: 'actor',
        organizacionId: 'org',
        esAdminPlataforma: true,
      } as never,
      { page: 6, pageSize: 20, rol: 'USUARIO', estado: 'activo', q: 'Ana' },
    );
    const where = tx.organizacionUsuario.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      organizacionId: 'org',
      rol: 'USUARIO',
      estado: 1,
      usuario: { estado: 1 },
    });
    expect(tx.organizacionUsuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 100, take: 20 }),
    );
    expect(result).toMatchObject({
      data: [],
      total: 105,
      page: 6,
      totalPages: 6,
      activos: 3,
      limite: 10,
    });
  });
});
