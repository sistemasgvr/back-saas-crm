import { Module } from '@nestjs/common';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { MetaPagesModule } from '../pages/meta-pages.module';
import { MetaLeadsModule } from '../leads/meta-leads.module';
import { PrismaModule } from '../../shared/infrastructure/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { WhatsappMessagingModule } from '../../whatsapp/messaging/whatsapp-messaging.module';
import { VerificarWebhookMetaUseCase } from './application/use-cases/verificar-webhook-meta.use-case';
import { MetaWebhooksController } from './presentation/meta-webhooks.controller';

@Module({
  imports: [
    MetaConnectionsModule,
    MetaPagesModule,
    MetaLeadsModule,
    PrismaModule,
    NotificationsModule,
    WhatsappMessagingModule,
  ],
  controllers: [MetaWebhooksController],
  providers: [VerificarWebhookMetaUseCase],
})
export class MetaWebhooksModule {}
