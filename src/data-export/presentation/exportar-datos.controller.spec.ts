import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../../shared/presentation/decorators/require-permission.decorator';
import { PermisosGuard } from '../../shared/presentation/guards/permisos.guard';
import { permisosPorDefecto } from '../../shared/domain/permisos';
import { ExportarDatosController } from './exportar-datos.controller';

const handler = Object.getOwnPropertyDescriptor(
  ExportarDatosController.prototype,
  'exportar',
)!.value as () => unknown;

function contexto(permisos: string[]): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ExportarDatosController,
    switchToHttp: () => ({ getRequest: () => ({ user: { permisos } }) }),
  } as unknown as ExecutionContext;
}

describe('ExportarDatosController — permisos', () => {
  const guard = new PermisosGuard(new Reflector());

  it('exige el permiso granular empresa.exportar', () => {
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler)).toEqual([
      'empresa.exportar',
    ]);
  });

  it('propietario y administrador lo tienen por defecto; el asesor no', () => {
    expect(permisosPorDefecto('PROPIETARIO')).toContain('empresa.exportar');
    expect(permisosPorDefecto('ADMINISTRADOR')).toContain('empresa.exportar');
    expect(permisosPorDefecto('USUARIO')).not.toContain('empresa.exportar');
  });

  it('rechaza a quien no tiene el permiso, aunque configure la empresa', () => {
    expect(() =>
      guard.canActivate(contexto(['empresa.configurar', 'leads.ver'])),
    ).toThrow(ForbiddenException);
  });

  it('deja pasar a un rol personalizado que sí lo tiene', () => {
    expect(guard.canActivate(contexto(['empresa.exportar']))).toBe(true);
  });
});
