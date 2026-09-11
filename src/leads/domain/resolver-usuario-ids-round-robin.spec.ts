import { resolverUsuarioIdsRoundRobin } from './resolver-usuario-ids-round-robin';

describe('resolverUsuarioIdsRoundRobin', () => {
  it('usa JSON cuando hay al menos 1 id', () => {
    expect(
      resolverUsuarioIdsRoundRobin({
        usuarioPrimeroId: 'a',
        usuarioSegundoId: 'b',
        usuarioIds: ['x'],
      }),
    ).toEqual(['x']);
  });

  it('cae a legacy primero/segundo si JSON vacío', () => {
    expect(
      resolverUsuarioIdsRoundRobin({
        usuarioPrimeroId: 'a',
        usuarioSegundoId: 'b',
        usuarioIds: [],
      }),
    ).toEqual(['a', 'b']);
  });

  it('filtra entradas inválidas del JSON', () => {
    expect(
      resolverUsuarioIdsRoundRobin({
        usuarioPrimeroId: 'a',
        usuarioSegundoId: 'b',
        usuarioIds: ['u1', '', null as unknown as string, 'u2'],
      }),
    ).toEqual(['u1', 'u2']);
  });
});
