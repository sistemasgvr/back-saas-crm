import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import type {
  RequestContext,
  RolOrganizacion,
} from '../../../auth/domain/request-context.interface';

/**
 * Revalida en vivo (no solo desde el JWT) que el usuario pertenece a la
 * organización activa y que tanto la membresía como la organización siguen
 * con estado = 1. Organización desactivada o membresía revocada → 403.
 * Refresca request.user.rol con el valor actual de la membresía.
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

    const membresia = await this.prisma.organizacionUsuario.findFirst({
      where: {
        usuarioId: user.usuarioId,
        organizacionId: user.organizacionId,
        estado: 1,
        organizacion: { estado: 1 },
      },
    });

    if (!membresia) {
      throw new ForbiddenException(
        'La organización no está activa o ya no perteneces a ella',
      );
    }

    request.user = { ...user, rol: membresia.rol as RolOrganizacion };
    return true;
  }
}
