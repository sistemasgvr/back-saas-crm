import type { PrismaService } from '../../shared/infrastructure/prisma.service';
import { PrismaOrganizacionModulosAdminRepository } from './prisma-organizacion-modulos-admin.repository';

function fixture(codigo: string, habilitado = 1) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([]),
    organizacion: { findUnique: jest.fn().mockResolvedValue({ id: 'org-a' }) },
    organizacionModulo: {
      findMany: jest.fn().mockResolvedValue([
        {
          moduloId: 'modulo',
          habilitado,
          estado: 1,
          fechaActivacion: new Date(),
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        habilitado,
        estado: 1,
        fechaActivacion: new Date(),
      }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    modulo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'modulo',
          codigo,
          requiere: [],
          estado: 1,
          grupo: { estado: 1 },
        },
      ]),
    },
    whatsappBotConfiguracion: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
  } as unknown as PrismaService;
  return { tx, repo: new PrismaOrganizacionModulosAdminRepository(prisma) };
}
describe('Jerarquía de automatizaciones por organización', () => {
  it.each(['WHATSAPP', 'AUTOMATIZACIONES'])(
    'desactivar %s invalida propuestas del bot en la misma transacción',
    async (codigo) => {
      const f = fixture(codigo);
      await f.repo.toggle('org-a', 'modulo', false, 'admin');
      expect(f.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        f.tx.organizacionModulo.upsert.mock.invocationCallOrder[0],
      );
      expect(f.tx.whatsappBotConfiguracion.updateMany).toHaveBeenCalledWith({
        where: { organizacionId: 'org-a' },
        data: { version: { increment: 1 } },
      });
    },
  );
  it('repetir el estado no invalida versiones', async () => {
    const f = fixture('AUTOMATIZACIONES');
    await f.repo.toggle('org-a', 'modulo', true, 'admin');
    expect(f.tx.whatsappBotConfiguracion.updateMany).not.toHaveBeenCalled();
  });
  it('cambiar otro módulo no afecta propuestas del bot', async () => {
    const f = fixture('INMUEBLES');
    await f.repo.toggle('org-a', 'modulo', false, 'admin');
    expect(f.tx.whatsappBotConfiguracion.updateMany).not.toHaveBeenCalled();
  });
});
