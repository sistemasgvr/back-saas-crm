import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { SincronizarLeadsOrganizacionUseCase } from '../application/use-cases/sincronizar-leads-organizacion.use-case';

@Controller('meta/leads')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaLeadsSyncController {
  constructor(
    private readonly sincronizar: SincronizarLeadsOrganizacionUseCase,
  ) {}

  /** Reimporta leads históricos de todos los formularios activos (lote acotado). */
  @Post('sync')
  sync(@CurrentUser() ctx: RequestContext) {
    return this.sincronizar.execute(ctx.organizacionId!);
  }
}
