import { Module } from '@nestjs/common';
import { WhatsappConnectionsModule } from './connections/whatsapp-connections.module';
import { WhatsappMessagingModule } from './messaging/whatsapp-messaging.module';
import { WhatsappCallsModule } from './calls/whatsapp-calls.module';

@Module({
  imports: [
    WhatsappConnectionsModule,
    WhatsappMessagingModule,
    WhatsappCallsModule,
  ],
})
export class WhatsappModule {}
