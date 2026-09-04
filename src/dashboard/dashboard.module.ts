import { Module } from '@nestjs/common';
import { MetaInsightsModule } from '../meta/insights/meta-insights.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DashboardController } from './presentation/dashboard.controller';
import { ObtenerKpisUseCase } from './application/use-cases/obtener-kpis.use-case';
import { ObtenerSeriesUseCase } from './application/use-cases/obtener-series.use-case';
import { ObtenerKpisPublicitariosUseCase } from './application/use-cases/obtener-kpis-publicitarios.use-case';
import { ObtenerSeriesPublicitariasUseCase } from './application/use-cases/obtener-series-publicitarias.use-case';
import { ObtenerEmbudoKpisUseCase } from './application/use-cases/obtener-embudo-kpis.use-case';
import { DASHBOARD_REPOSITORY } from './application/ports/dashboard.repository.port';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository';

@Module({
  imports: [MetaInsightsModule, OrganizationsModule],
  controllers: [DashboardController],
  providers: [
    ObtenerKpisUseCase,
    ObtenerSeriesUseCase,
    ObtenerKpisPublicitariosUseCase,
    ObtenerSeriesPublicitariasUseCase,
    ObtenerEmbudoKpisUseCase,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
  ],
})
export class DashboardModule {}
