import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../../shared/presentation/guards/org-membership.guard';
import { RolesGuard } from '../../../shared/presentation/guards/roles.guard';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ModuleGuard } from '../../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../../shared/presentation/decorators/require-module.decorator';
import { SincronizarInsightsCuentaUseCase } from '../application/use-cases/sincronizar-insights-cuenta.use-case';
import { SincronizarInsightsDto } from './dto/sincronizar-insights.dto';

/** Ruta anidada bajo /meta/ad-accounts/:id — controller separado (misma base path
 * que MetaAdAccountsController, sin colisión: :id/insights/sync difiere en profundidad de :id/sync). */
@Controller('meta/ad-accounts')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, RolesGuard, ModuleGuard)
@Roles('PROPIETARIO', 'ADMINISTRADOR')
@RequireModule('META_LEADS')
export class MetaInsightsController {
  constructor(private readonly sincronizar: SincronizarInsightsCuentaUseCase) {}

  @Post(':id/insights/sync')
  sync(
    @CurrentUser() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SincronizarInsightsDto,
  ) {
    return this.sincronizar.execute(
      ctx.organizacionId!,
      id,
      { desde: dto.desde, hasta: dto.hasta },
      ctx.usuarioId,
    );
  }
}
