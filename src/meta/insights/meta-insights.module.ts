import { Module, forwardRef } from '@nestjs/common';
import { MetaAdAccountsModule } from '../ad-accounts/meta-ad-accounts.module';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { MetaInsightsController } from './presentation/meta-insights.controller';
import { SincronizarInsightsCuentaUseCase } from './application/use-cases/sincronizar-insights-cuenta.use-case';
import { META_INSIGHTS_REPOSITORY } from './application/ports/meta-insights.repository.port';
import { PrismaMetaInsightsRepository } from './infrastructure/prisma-meta-insights.repository';

@Module({
  imports: [
    forwardRef(() => MetaAdAccountsModule),
    MetaConnectionsModule,
    CampaignsModule,
  ],
  controllers: [MetaInsightsController],
  providers: [
    SincronizarInsightsCuentaUseCase,
    {
      provide: META_INSIGHTS_REPOSITORY,
      useClass: PrismaMetaInsightsRepository,
    },
  ],
  exports: [META_INSIGHTS_REPOSITORY],
})
export class MetaInsightsModule {}
