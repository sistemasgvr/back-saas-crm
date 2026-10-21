import type { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { PrismaWhatsappConversacionesRepository } from './prisma-whatsapp-conversaciones.repository';

describe('Paginación de conversaciones', () => {
  it('rechaza un cursor de otra conversación antes de consultar sus mensajes', async () => {
    const prisma = {
      whatsappMensaje: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
    };
    const repository = new PrismaWhatsappConversacionesRepository(
      prisma as unknown as PrismaService,
    );
    await expect(
      repository.listarMensajes('chat', 51, 'ajeno'),
    ).rejects.toThrow('Mensaje no encontrado');
    expect(prisma.whatsappMensaje.findFirst).toHaveBeenCalledWith({
      where: { id: 'ajeno', whatsappConversacionId: 'chat' },
      select: { id: true },
    });
    expect(prisma.whatsappMensaje.findMany).not.toHaveBeenCalled();
  });
  it('aplica la misma organización, visibilidad y búsqueda al conteo y a la página', async () => {
    const prisma = {
      whatsappConversacion: {
        count: jest.fn().mockResolvedValue(105),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const repository = new PrismaWhatsappConversacionesRepository(
      prisma as unknown as PrismaService,
    );
    const result = await repository.listar(
      'org',
      { modo: 'usuario', usuarioId: 'asesor' },
      {
        page: 6,
        pageSize: 20,
        q: 'Ana',
        borradores: '00000000-0000-4000-8000-000000000001',
      },
    );
    const countWhere = prisma.whatsappConversacion.count.mock.calls[0][0].where;
    expect(countWhere).toMatchObject({
      organizacionId: 'org',
      estado: 1,
      lead: { asignadoUsuarioId: 'asesor' },
    });
    expect(prisma.whatsappConversacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: countWhere,
        skip: 100,
        take: 20,
        orderBy: [
          { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
          { id: 'desc' },
        ],
      }),
    );
    expect(result).toMatchObject({
      total: 105,
      page: 6,
      pageSize: 20,
      totalPages: 6,
    });
  });
});
