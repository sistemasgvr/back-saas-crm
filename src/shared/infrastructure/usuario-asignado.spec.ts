import { referenciaUsuarioAsignado } from './usuario-asignado';

describe('Estado del responsable del lead', () => {
  const usuario = {
    id: 'u',
    nombre: 'David',
    apellido: null,
    estado: 1,
    organizacionUsuarios: [{ organizacionId: 'org', estado: 1 }],
  };
  it('marca activo únicamente con cuenta y membresía activas en esta empresa', () => {
    expect(referenciaUsuarioAsignado(usuario, 'org')?.activo).toBe(true);
    expect(
      referenciaUsuarioAsignado({ ...usuario, estado: 0 }, 'org')?.activo,
    ).toBe(false);
    expect(
      referenciaUsuarioAsignado(
        {
          ...usuario,
          organizacionUsuarios: [{ organizacionId: 'org', estado: 0 }],
        },
        'org',
      )?.activo,
    ).toBe(false);
    expect(referenciaUsuarioAsignado(usuario, 'otra')?.activo).toBe(false);
    expect(referenciaUsuarioAsignado(null, 'org')).toBeNull();
  });
});
