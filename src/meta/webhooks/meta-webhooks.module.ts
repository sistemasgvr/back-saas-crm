import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { MetaLeadsModule } from '../leads/meta-leads.module';
import { PrismaModule } from '../../shared/infrastructure/prisma.module';
import { VerificarWebhookMetaUseCase } from './application/use-cases/verificar-webhook-meta.use-case';
import { MetaWebhooksController } from './presentation/meta-webhooks.controller';

@Module({
  imports: [MetaConnectionsModule, MetaLeadsModule, PrismaModule],
  controllers: [MetaWebhooksController],
  providers: [VerificarWebhookMetaUseCase],
})
export class MetaWebhooksModule {}
