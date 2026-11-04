import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { resolverPermisosEfectivos } from '../../infrastructure/permisos-efectivos';
import type { RequestContext } from '../../../auth/domain/request-context.interface';

/**
 * Revalida en vivo (no solo desde el JWT) que el usuario pertenece a la
 * organización activa y que tanto la membresía como la organización siguen
 * con estado = 1. Organización desactivada o membresía revocada → 403.
 * Refresca request.user.rol y calcula request.user.permisos (rol ∩ módulos
 * activos): un cambio de rol aplica en la siguiente petición.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user: RequestContext }>();
    const user = request.user;

    if (!user?.organizacionId) {
      throw new ForbiddenException(
        'No hay una organización activa en la sesión',
      );
    }

    const membresia = await resolverPermisosEfectivos(
      this.prisma,
      user.organizacionId,
      user.usuarioId,
    );

    if (!membresia) {
      throw new ForbiddenException(
        'La organización no está activa o ya no perteneces a ella',
      );
    }

    request.user = {
      ...user,
      rol: membresia.rol,
      permisos: membresia.permisos,
    };
    return true;
  }
}
