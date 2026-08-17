import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../shared/presentation/decorators/require-module.decorator';
import { ObtenerKpisUseCase } from '../application/use-cases/obtener-kpis.use-case';
import { ObtenerSeriesUseCase } from '../application/use-cases/obtener-series.use-case';
import { FiltroDashboardQueryDto } from './dto/filtro-dashboard.query.dto';
import { FiltroSeriesQueryDto } from './dto/filtro-series.query.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('DASHBOARD')
export class DashboardController {
  constructor(
    private readonly obtenerKpis: ObtenerKpisUseCase,
    private readonly obtenerSeries: ObtenerSeriesUseCase,
  ) {}

  @Get('kpis')
  getKpis(@CurrentUser() ctx: RequestContext, @Query() query: FiltroDashboardQueryDto) {
    return this.obtenerKpis.execute(ctx.organizacionId!, query);
  }

  @Get('series')
  getSeries(@CurrentUser() ctx: RequestContext, @Query() query: FiltroSeriesQueryDto) {
    return this.obtenerSeries.execute(ctx.organizacionId!, query);
  }
}
