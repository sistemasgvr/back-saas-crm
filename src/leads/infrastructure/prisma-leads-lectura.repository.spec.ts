import type { PrismaService } from '../../shared/infrastructure/prisma.service';
import { PrismaLeadsLecturaRepository } from './prisma-leads-lectura.repository';

describe('Paginación del tablero', () => {
  it('permite navegar después del antiguo tope de 300 y filtra antes de contar', async () => {
    const prisma = {
      lead: {
        count: jest.fn().mockResolvedValue(305),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const repository = new PrismaLeadsLecturaRepository(
      prisma as unknown as PrismaService,
    );
    const result = await repository.listarParaTablero('org', {
      tipoLead: 'COMPRA',
      asignacion: { modo: 'usuario', usuarioId: 'asesor' },
      page: 4,
      pageSize: 100,
      q: 'Ana',
    });
    const where = prisma.lead.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      organizacionId: 'org',
      estado: 1,
      tipoLead: 'COMPRA',
    });
    expect(where.AND).toContainEqual({ asignadoUsuarioId: 'asesor' });
    expect(where.AND).toHaveLength(2);
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 300,
        take: 100,
        orderBy: [{ fechaLead: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result).toMatchObject({
      total: 305,
      page: 4,
      pageSize: 100,
      totalPages: 4,
    });
  });
});
