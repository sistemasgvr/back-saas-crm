import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { permisoDelCatalogo, type CodigoPermiso } from '../../domain/permisos';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * Exige alguno de los permisos de @RequirePermission entre los permisos
 * efectivos que calculó OrgMembershipGuard (rol ∩ módulos activos). Debe
 * correr después de OrgMembershipGuard y de ModuleGuard.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<CodigoPermiso[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requeridos || requeridos.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: RequestContext }>();
    const permisos = user?.permisos ?? [];
    if (requeridos.some((p) => permisos.includes(p))) return true;

    const nombres = requeridos
      .map((p) => permisoDelCatalogo(p)?.nombre ?? p)
      .join(' o ');
    throw new ForbiddenException(
      `No tienes permiso para esta acción: ${nombres}`,
    );
  }
}
