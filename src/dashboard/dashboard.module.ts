import { Module } from '@nestjs/common';
import { DashboardController } from './presentation/dashboard.controller';
import { ObtenerKpisUseCase } from './application/use-cases/obtener-kpis.use-case';
import { ObtenerSeriesUseCase } from './application/use-cases/obtener-series.use-case';
import { DASHBOARD_REPOSITORY } from './application/ports/dashboard.repository.port';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository';

@Module({
  controllers: [DashboardController],
  providers: [
    ObtenerKpisUseCase,
    ObtenerSeriesUseCase,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
  ],
})
export class DashboardModule {}
