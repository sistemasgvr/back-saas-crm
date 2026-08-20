import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { MetaPagesModule } from '../pages/meta-pages.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdsetsModule } from '../adsets/adsets.module';
import { AdsModule } from '../ads/ads.module';
import { ProcesarLeadEntranteUseCase } from './application/use-cases/procesar-lead-entrante.use-case';
import { IngestarLeadGraphUseCase } from './application/use-cases/ingestar-lead-graph.use-case';
import { BackfillLeadsFormularioUseCase } from './application/use-cases/backfill-leads-formulario.use-case';
import { LEADS_REPOSITORY } from './application/ports/leads.repository.port';
import { PrismaLeadsRepository } from './infrastructure/prisma-leads.repository';

@Module({
  imports: [
    MetaConnectionsModule,
    MetaPagesModule,
    CampaignsModule,
    AdsetsModule,
    AdsModule,
  ],
  providers: [
    ProcesarLeadEntranteUseCase,
    IngestarLeadGraphUseCase,
    BackfillLeadsFormularioUseCase,
    { provide: LEADS_REPOSITORY, useClass: PrismaLeadsRepository },
  ],
  exports: [ProcesarLeadEntranteUseCase, BackfillLeadsFormularioUseCase],
})
export class MetaLeadsModule {}
