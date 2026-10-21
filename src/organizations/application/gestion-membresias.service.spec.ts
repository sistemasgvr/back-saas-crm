import { GestionMembresiasService } from './gestion-membresias.service';

describe('Reglas de gestión de membresías', () => {
  const ctx = {
    usuarioId: 'actor',
    organizacionId: 'org',
    esAdminPlataforma: false,
  };
  const service = new GestionMembresiasService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const reglas = service as any;
  it.each(['PROPIETARIO', 'ADMINISTRADOR'])(
    'una cuenta de empresa %s no promueve propietarios',
    () => {
      expect(() => reglas.proteger(null, 'PROPIETARIO', 1, ctx, false)).toThrow(
        'plataforma',
      );
    },
  );
  it('ni siquiera el propietario de empresa modifica una cuenta propietaria', () => {
    expect(() =>
      reglas.proteger(
        { rol: 'PROPIETARIO', usuarioId: 'otro' },
        undefined,
        undefined,
        ctx,
        false,
      ),
    ).toThrow('plataforma');
  });
  it('plataforma también tiene prohibido desactivarse', () => {
    expect(() =>
      reglas.proteger(
        { rol: 'ADMINISTRADOR', usuarioId: 'actor' },
        undefined,
        0,
        ctx,
        true,
      ),
    ).toThrow('No puedes');
  });
  it('el cupo ilimitado admite altas y el cupo lleno las bloquea', async () => {
    const tx = {
      organizacion: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ limiteUsuarios: null }),
      },
      organizacionUsuario: { count: jest.fn().mockResolvedValue(20) },
    };
    await expect(reglas.cupo(tx, 'org')).resolves.toBeUndefined();
    tx.organizacion.findUniqueOrThrow.mockResolvedValue({ limiteUsuarios: 20 });
    await expect(reglas.cupo(tx, 'org')).rejects.toThrow('límite');
  });
  it('no exige cambiar datos históricos de una empresa sin propietarios', async () => {
    const tx = { organizacionUsuario: { count: jest.fn() } };
    await reglas.ultimoPropietario(
      tx,
      { rol: 'USUARIO', estado: 1 },
      undefined,
      0,
    );
    expect(tx.organizacionUsuario.count).not.toHaveBeenCalled();
  });
});
