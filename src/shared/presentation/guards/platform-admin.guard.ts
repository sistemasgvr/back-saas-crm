import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import type { RequestContext } from '../../../auth/domain/request-context.interface';

/**
 * Solo rutas /admin/*. Revalida en vivo contra la DB que el usuario sigue
 * siendo es_admin_plataforma = 1 y estado = 1 (no confía únicamente en el
 * claim del access token, igual que OrgMembershipGuard) — PLAN.md §5.4.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user: RequestContext }>();

    const usuario = user?.usuarioId
      ? await this.prisma.usuario.findFirst({
          where: { id: user.usuarioId, estado: 1, esAdminPlataforma: 1 },
        })
      : null;

    if (!usuario) {
      throw new ForbiddenException(
        'Requiere permisos de administrador de plataforma',
      );
    }

    return true;
  }
}
