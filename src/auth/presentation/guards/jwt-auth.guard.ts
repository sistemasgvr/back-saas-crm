import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type { RequestContext } from '../../domain/request-context.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) return false;
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: RequestContext }>();
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: req.user.usuarioId },
      select: {
        estado: true,
        debeCambiarPassword: true,
        esAdminPlataforma: true,
      },
    });
    if (!usuario || usuario.estado !== 1)
      throw new UnauthorizedException('Usuario inactivo');
    req.user.esAdminPlataforma = usuario.esAdminPlataforma === 1;
    const ruta = req.path.replace(/\/$/, '').replace(/^\/api/, '');
    const permitido =
      (req.method === 'GET' && ruta === '/me') ||
      (req.method === 'PATCH' && ruta === '/me/password');
    if (usuario.debeCambiarPassword === 1 && !permitido)
      throw new ForbiddenException({
        message: 'Debes cambiar tu contraseña temporal para continuar',
        code: 'DEBE_CAMBIAR_PASSWORD',
      });
    return true;
  }
}
