import type { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { PrismaWhatsappConexionesRepository } from './prisma-whatsapp-conexiones.repository';

function fixture(estado = 0) {
  const saved = {
    id: 'line',
    organizacionId: 'org',
    metaConexionId: 'meta',
    wabaId: 'waba',
    phoneNumberId: 'phone',
    estado,
    estadoNumero: 'DISCONNECTED',
    webhookSuscrito: 1,
    webhookSuscritoEn: new Date(),
    webhookUltimoCheckEn: new Date(),
    webhookUltimoError: 'error de una conexión anterior',
    callingHabilitado: 1,
    callingUltimoError: 'error anterior',
  };
  const db = {
    whatsappConexion: {
      findFirst: jest.fn().mockResolvedValue(saved),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve(Object.assign(saved, data)),
        ),
      create: jest.fn(),
    },
    whatsappOnboarding: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  return {
    db,
    saved,
    repo: new PrismaWhatsappConexionesRepository(
      db as unknown as PrismaService,
    ),
  };
}
const input = {
  organizacionId: 'org',
  metaConexionId: 'meta',
  wabaId: 'waba',
  phoneNumberId: 'phone',
  usuarioEdicion: 'admin',
};

describe('Estado de WhatsApp al desvincular y reconectar', () => {
  it('reactiva el mismo ID sin arrastrar DISCONNECTED, errores ni salud del enlace anterior', async () => {
    const f = fixture();
    const result = await f.repo.vincular(input);
    expect(result.id).toBe('line');
    expect(f.db.whatsappConexion.create).not.toHaveBeenCalled();
    expect(result.estadoNumero).toBeNull();
    expect(result.webhookSuscrito).toBe(false);
    expect(result.webhookSuscritoEn).toBeNull();
    expect(result.webhookUltimoCheckEn).toBeNull();
    expect(result.webhookUltimoError).toBeNull();
    expect(result.callingHabilitado).toBe(false);
    expect(result.callingUltimoError).toBeNull();
  });
  it('la nueva lectura de Meta reemplaza el estado de la vinculación anterior', async () => {
    const f = fixture();
    expect(
      (await f.repo.vincular({ ...input, estadoNumero: 'CONNECTED' }))
        .estadoNumero,
    ).toBe('CONNECTED');
  });
  it('no desactiva el estado de llamadas de una vinculación activa que no cambió', async () => {
    const f = fixture(1);
    expect(
      (await f.repo.vincular({ ...input, estadoNumero: 'CONNECTED' }))
        .callingHabilitado,
    ).toBe(true);
  });
  it('desvincula por soft delete y descarta grants pendientes conservando la fila histórica', async () => {
    const f = fixture(1);
    const result = await f.repo.desvincular('org', 'line', 'admin');
    expect(result?.id).toBe('line');
    expect(f.saved.estado).toBe(0);
    expect(result?.estadoNumero).toBeNull();
    expect(result?.webhookSuscrito).toBe(false);
    expect(result?.webhookUltimoError).toBeNull();
    expect(f.db.whatsappOnboarding.updateMany).toHaveBeenCalledWith({
      where: {
        organizacionId: 'org',
        metaConexionId: 'meta',
        estado: 'TOKEN',
        OR: [{ wabaId: null }, { wabaId: 'waba' }],
      },
      data: { estado: 'CANCELADO', tokenCifrado: '' },
    });
    expect(f.db.$transaction).toHaveBeenCalledTimes(1);
  });
});
