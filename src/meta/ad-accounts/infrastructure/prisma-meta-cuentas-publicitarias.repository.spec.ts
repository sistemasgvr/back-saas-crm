import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { PrismaMetaCuentasPublicitariasRepository } from './prisma-meta-cuentas-publicitarias.repository';

it('consulta la página en SQL con orden global y devuelve total y orden de las filas', async () => {
  const ids = [{ id: 'activa' }, { id: 'pausada' }];
  const query = jest.fn().mockResolvedValue(ids);
  const count = jest.fn().mockResolvedValue(15);
  const findMany = jest.fn().mockResolvedValue([
    {
      id: 'pausada',
      nombre: 'A pausada',
      estadoMeta: 'PAUSED',
      _count: { leads: 1 },
    },
    {
      id: 'activa',
      nombre: 'Z activa',
      estadoMeta: 'ACTIVE',
      _count: { leads: 3 },
    },
  ]);
  const repo = new PrismaMetaCuentasPublicitariasRepository({
    $queryRaw: query,
    campana: { count, findMany },
  } as unknown as PrismaService);
  const resultado = await repo.listarCampanas('cuenta', 2, 10);
  expect(resultado).toMatchObject({
    total: 15,
    page: 2,
    pageSize: 10,
    totalPages: 2,
  });
  expect(resultado.data.map((c) => c.id)).toEqual(['activa', 'pausada']);
  const [sql] = query.mock.calls[0] as [{ sql: string; values: unknown[] }];
  expect(sql.sql).toContain("WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2");
  expect(sql.sql).toContain('LIMIT ? OFFSET ?');
  expect(sql.values).toEqual(['cuenta', 10, 10]);
  expect((findMany.mock.calls[0] as [{ where: unknown }])[0].where).toEqual({
    id: { in: ['activa', 'pausada'] },
    metaCuentaPublicitariaId: 'cuenta',
    estado: 1,
  });
  expect(
    (
      findMany.mock.calls[0] as [
        { include: { _count: { select: { leads: unknown } } } },
      ]
    )[0].include._count.select.leads,
  ).toEqual({
    where: { estado: 1 },
  });
});

it('conserva el total al pedir una página vacía', async () => {
  const repo = new PrismaMetaCuentasPublicitariasRepository({
    $queryRaw: jest.fn().mockResolvedValue([]),
    campana: {
      count: jest.fn().mockResolvedValue(15),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService);
  expect(await repo.listarCampanas('cuenta', 3, 10)).toEqual({
    data: [],
    total: 15,
    page: 3,
    pageSize: 10,
    totalPages: 2,
  });
});
