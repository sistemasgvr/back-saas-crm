import type { PrismaService } from '../../shared/infrastructure/prisma.service';
import { PrismaNotificacionesRepository } from './prisma-notificaciones.repository';

describe('Lectura de notificaciones agrupadas', () => {
  const fecha = new Date('2026-10-30T17:00:00Z');
  function fixture(
    tipo = 'WHATSAPP_MENSAJE',
    conversacionId: unknown = 'chat-a',
  ) {
    const tx = {
      notificacionUsuario: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'aviso',
          fechaCreacion: fecha,
          notificacion: {
            tipo,
            payload: { whatsappConversacionId: conversacionId },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const prisma = {
      $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    };
    return {
      tx,
      repo: new PrismaNotificacionesRepository(
        prisma as unknown as PrismaService,
      ),
    };
  }

  it('marca el chat completo hasta el aviso abierto, con aislamiento por usuario y organización', async () => {
    const { tx, repo } = fixture();
    expect(await repo.marcarLeida('org', 'user', 'aviso')).toBe(true);
    expect(tx.notificacionUsuario.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'aviso',
        organizacionId: 'org',
        usuarioId: 'user',
        estado: 1,
      },
      include: { notificacion: true },
    });
    expect(tx.notificacionUsuario.updateMany).toHaveBeenCalledWith({
      where: {
        organizacionId: 'org',
        usuarioId: 'user',
        estado: 1,
        fechaCreacion: { lte: fecha },
        notificacion: {
          tipo: 'WHATSAPP_MENSAJE',
          payload: { path: ['whatsappConversacionId'], equals: 'chat-a' },
        },
      },
      data: { leida: 1, fechaLectura: expect.any(Date) as Date },
    });
  });

  it.each([
    ['LEAD_NUEVO', 'chat-a'],
    ['WHATSAPP_MENSAJE', null],
    ['WHATSAPP_MENSAJE', ''],
    ['WHATSAPP_MENSAJE', 42],
  ])(
    'mantiene individual el aviso de tipo %s con conversación %s',
    async (tipo, chat) => {
      const { tx, repo } = fixture(tipo, chat);
      await repo.marcarLeida('org', 'user', 'aviso');
      expect(tx.notificacionUsuario.updateMany).toHaveBeenCalledWith({
        where: {
          organizacionId: 'org',
          usuarioId: 'user',
          estado: 1,
          id: 'aviso',
        },
        data: { leida: 1, fechaLectura: expect.any(Date) as Date },
      });
    },
  );

  it('no modifica avisos ajenos, inexistentes o inactivos', async () => {
    const { tx, repo } = fixture();
    tx.notificacionUsuario.findFirst.mockResolvedValue(null);
    expect(await repo.marcarLeida('org', 'user', 'otro')).toBe(false);
    expect(tx.notificacionUsuario.updateMany).not.toHaveBeenCalled();
  });
});
