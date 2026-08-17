import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from './connections/meta-connections.module';

// webhooks/campaigns/adsets/ads/leads se agregan en Fase 8-9.
@Module({
  imports: [MetaConnectionsModule],
})
export class MetaModule {}
