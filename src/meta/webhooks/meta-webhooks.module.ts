import { Module } from '@nestjs/common';
import { MetaLeadsModule } from '../leads/meta-leads.module';
import { MetaWebhooksController } from './presentation/meta-webhooks.controller';

@Module({
  imports: [MetaLeadsModule],
  controllers: [MetaWebhooksController],
})
export class MetaWebhooksModule {}
