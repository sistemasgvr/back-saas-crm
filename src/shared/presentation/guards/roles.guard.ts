import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
  RolOrganizacion,
  RequestContext,
} from '../../../auth/domain/request-context.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolOrganizacion[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: RequestContext }>();
    if (!user?.rol || !rolesRequeridos.includes(user.rol)) {
      throw new ForbiddenException('Tu rol no permite esta acción');
    }

    return true;
  }
}
