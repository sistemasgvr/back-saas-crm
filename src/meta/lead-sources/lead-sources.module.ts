import { WhatsappAdAttributionService } from './whatsapp-ad-attribution.service';
import { Module } from '@nestjs/common';
import { LeadSourcesService } from './lead-sources.service';
import { LeadSourcesController } from './lead-sources.controller';

@Module({
  controllers: [LeadSourcesController],
  providers: [LeadSourcesService, WhatsappAdAttributionService],
  exports: [LeadSourcesService, WhatsappAdAttributionService],
})
export class LeadSourcesModule {}
