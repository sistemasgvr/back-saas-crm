import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import type { RequestContext } from '../../auth/domain/request-context.interface';
import { OrgMembershipGuard } from '../../shared/presentation/guards/org-membership.guard';
import { ModuleGuard } from '../../shared/presentation/guards/module.guard';
import { RequireModule } from '../../shared/presentation/decorators/require-module.decorator';
import { ObtenerKpisUseCase } from '../application/use-cases/obtener-kpis.use-case';
import { ObtenerSeriesUseCase } from '../application/use-cases/obtener-series.use-case';
import { ObtenerKpisPublicitariosUseCase } from '../application/use-cases/obtener-kpis-publicitarios.use-case';
import { ObtenerSeriesPublicitariasUseCase } from '../application/use-cases/obtener-series-publicitarias.use-case';
import { ObtenerEmbudoKpisUseCase } from '../application/use-cases/obtener-embudo-kpis.use-case';
import { FiltroDashboardQueryDto } from './dto/filtro-dashboard.query.dto';
import { FiltroSeriesQueryDto } from './dto/filtro-series.query.dto';
import { FiltroEmbudoQueryDto } from './dto/filtro-embudo.query.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrgMembershipGuard, ModuleGuard)
@RequireModule('DASHBOARD')
export class DashboardController {
  constructor(
    private readonly obtenerKpis: ObtenerKpisUseCase,
    private readonly obtenerSeries: ObtenerSeriesUseCase,
    private readonly obtenerKpisPublicitarios: ObtenerKpisPublicitariosUseCase,
    private readonly obtenerSeriesPublicitarias: ObtenerSeriesPublicitariasUseCase,
    private readonly obtenerEmbudoKpis: ObtenerEmbudoKpisUseCase,
  ) {}

  @Get('kpis')
  @ApiOperation({
    summary: 'KPIs de leads',
    description:
      'Totales de leads (nuevos, contactados, convertidos, etc.) para el rango y filtros dados.',
  })
  @ApiResponse({ status: 200, description: 'KPIs calculados.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'La organización no tiene el módulo DASHBOARD activo.',
  })
  getKpis(
    @CurrentUser() ctx: RequestContext,
    @Query() query: FiltroDashboardQueryDto,
  ) {
    return this.obtenerKpis.execute(ctx.organizacionId!, query);
  }

  @Get('series')
  @ApiOperation({
    summary: 'Serie temporal de leads',
    description: 'Conteo de leads agrupado por día para graficar tendencia.',
  })
  @ApiResponse({ status: 200, description: 'Puntos de la serie.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'La organización no tiene el módulo DASHBOARD activo.',
  })
  getSeries(
    @CurrentUser() ctx: RequestContext,
    @Query() query: FiltroSeriesQueryDto,
  ) {
    return this.obtenerSeries.execute(ctx.organizacionId!, query);
  }

  @Get('ads-kpis')
  @ApiOperation({
    summary: 'KPIs publicitarios',
    description:
      'Gasto, impresiones, clics y costo por lead agregados desde Meta Insights.',
  })
  @ApiResponse({ status: 200, description: 'KPIs publicitarios calculados.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'La organización no tiene el módulo DASHBOARD activo.',
  })
  getAdsKpis(
    @CurrentUser() ctx: RequestContext,
    @Query() query: FiltroSeriesQueryDto,
  ) {
    return this.obtenerKpisPublicitarios.execute(ctx.organizacionId!, query);
  }

  @Get('ads-series')
  @ApiOperation({
    summary: 'Serie temporal publicitaria',
    description: 'Gasto/impresiones/clics por día desde Meta Insights.',
  })
  @ApiResponse({ status: 200, description: 'Puntos de la serie publicitaria.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'La organización no tiene el módulo DASHBOARD activo.',
  })
  getAdsSeries(
    @CurrentUser() ctx: RequestContext,
    @Query() query: FiltroSeriesQueryDto,
  ) {
    return this.obtenerSeriesPublicitarias.execute(ctx.organizacionId!, query);
  }

  @Get('embudo-kpis')
  @ApiOperation({
    summary: 'KPIs del embudo de gestión',
    description:
      'Conteo por estadoGestion, tasa de contacto, conversión a ganado y tiempo promedio en etapa. ' +
      'Filtros de fecha, tipoLead y asignado (mismos criterios que listado de leads).',
  })
  @ApiResponse({ status: 200, description: 'KPIs de embudo calculados.' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'La organización no tiene el módulo DASHBOARD activo.',
  })
  getEmbudoKpis(
    @CurrentUser() ctx: RequestContext,
    @Query() query: FiltroEmbudoQueryDto,
  ) {
    return this.obtenerEmbudoKpis.execute(ctx, query);
  }
}
