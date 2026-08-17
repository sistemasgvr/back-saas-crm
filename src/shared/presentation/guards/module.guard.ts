import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/prisma.service';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';

/**
 * Exige que la organización activa tenga el módulo habilitado
 * (organizacion_modulos.habilitado = 1, estado = 1) y que el módulo siga
 * vigente en el catálogo (modulos.estado = 1). Apagado o retirado → 403,
 * nunca 404 silencioso (PLAN.md §5.4). Debe correr después de OrgMembershipGuard.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const codigo = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!codigo) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: RequestContext }>();
    if (!user?.organizacionId) {
      throw new ForbiddenException('No hay una organización activa en la sesión');
    }

    const relacion = await this.prisma.organizacionModulo.findFirst({
      where: {
        organizacionId: user.organizacionId,
        habilitado: 1,
        estado: 1,
        modulo: { codigo, estado: 1 },
      },
    });

    if (!relacion) {
      throw new ForbiddenException(`El módulo ${codigo} no está habilitado para esta organización`);
    }

    return true;
  }
}
