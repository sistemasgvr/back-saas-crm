import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdsetsModule } from '../adsets/adsets.module';
import { AdsModule } from '../ads/ads.module';
import { ProcesarLeadEntranteUseCase } from './application/use-cases/procesar-lead-entrante.use-case';
import { LEADS_REPOSITORY } from './application/ports/leads.repository.port';
import { PrismaLeadsRepository } from './infrastructure/prisma-leads.repository';

@Module({
  imports: [MetaConnectionsModule, CampaignsModule, AdsetsModule, AdsModule],
  providers: [
    ProcesarLeadEntranteUseCase,
    { provide: LEADS_REPOSITORY, useClass: PrismaLeadsRepository },
  ],
  exports: [ProcesarLeadEntranteUseCase],
})
export class MetaLeadsModule {}
