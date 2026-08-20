import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from './connections/meta-connections.module';
import { MetaPagesModule } from './pages/meta-pages.module';
import { MetaAdAccountsModule } from './ad-accounts/meta-ad-accounts.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AdsetsModule } from './adsets/adsets.module';
import { AdsModule } from './ads/ads.module';
import { MetaLeadsModule } from './leads/meta-leads.module';
import { MetaWebhooksModule } from './webhooks/meta-webhooks.module';
import { MetaFormsModule } from './forms/meta-forms.module';
import { MetaInsightsModule } from './insights/meta-insights.module';

@Module({
  imports: [
    MetaConnectionsModule,
    MetaPagesModule,
    MetaAdAccountsModule,
    CampaignsModule,
    AdsetsModule,
    AdsModule,
    MetaLeadsModule,
    MetaWebhooksModule,
    MetaFormsModule,
    MetaInsightsModule,
  ],
})
export class MetaModule {}
