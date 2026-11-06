import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { PrismaMetaCuentasPublicitariasRepository } from './prisma-meta-cuentas-publicitarias.repository';

it('lista las 15 campañas de la cuenta sin recortar a 10 ni filtrar por estado de Meta', async () => {
  const filas = Array.from({ length: 15 }, (_, i) => ({
    id: String(i),
    nombre: `Campaña ${i}`,
    estadoMeta: i % 2 ? 'ACTIVE' : 'PAUSED',
    _count: { leads: i },
  }));
  const findMany = jest.fn().mockResolvedValue(filas);
  const repo = new PrismaMetaCuentasPublicitariasRepository({
    campana: { findMany },
  } as unknown as PrismaService);
  const resultado = await repo.listarUltimasCampanas('cuenta');
  expect(resultado).toHaveLength(15);
  expect(findMany.mock.calls[0][0]).not.toHaveProperty('take');
  expect(findMany.mock.calls[0][0].where).toEqual({
    metaCuentaPublicitariaId: 'cuenta',
    estado: 1,
  });
});
