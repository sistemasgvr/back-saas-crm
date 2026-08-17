import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from './connections/meta-connections.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AdsetsModule } from './adsets/adsets.module';
import { AdsModule } from './ads/ads.module';
import { MetaLeadsModule } from './leads/meta-leads.module';
import { MetaWebhooksModule } from './webhooks/meta-webhooks.module';

@Module({
  imports: [
    MetaConnectionsModule,
    CampaignsModule,
    AdsetsModule,
    AdsModule,
    MetaLeadsModule,
    MetaWebhooksModule,
  ],
})
export class MetaModule {}
