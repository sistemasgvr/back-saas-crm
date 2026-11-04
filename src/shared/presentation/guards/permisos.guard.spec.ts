import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermisosGuard } from './permisos.guard';

function contexto(permisos?: string[]): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { usuarioId: 'u', permisos } }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermisosGuard', () => {
  const reflector = new Reflector();
  const guard = new PermisosGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('deja pasar si el endpoint no exige permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contexto())).toBe(true);
  });

  it('basta con uno de los permisos indicados', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['leads.asignar', 'leads.ver_todos']);
    expect(guard.canActivate(contexto(['leads.ver_todos']))).toBe(true);
  });

  it('responde 403 con el nombre del permiso faltante', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['leads.asignar']);
    expect(() => guard.canActivate(contexto(['leads.ver']))).toThrow(
      new ForbiddenException(
        'No tienes permiso para esta acción: Asignar leads',
      ),
    );
  });

  it('sin permisos calculados en la petición, niega', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['leads.ver']);
    expect(() => guard.canActivate(contexto())).toThrow(ForbiddenException);
  });
});
