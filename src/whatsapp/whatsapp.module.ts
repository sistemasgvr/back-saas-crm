import { Module } from '@nestjs/common';
import { WhatsappConnectionsModule } from './connections/whatsapp-connections.module';
import { WhatsappMessagingModule } from './messaging/whatsapp-messaging.module';

@Module({
  imports: [WhatsappConnectionsModule, WhatsappMessagingModule],
})
export class WhatsappModule {}
