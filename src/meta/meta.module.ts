import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from './connections/meta-connections.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AdsetsModule } from './adsets/adsets.module';
import { AdsModule } from './ads/ads.module';

// webhooks/leads (ingestión) se agregan en Fase 9.
@Module({
  imports: [MetaConnectionsModule, CampaignsModule, AdsetsModule, AdsModule],
})
export class MetaModule {}
