import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type { WhatsappLlamadasRepository } from '../ports/whatsapp-llamadas.repository.port';

@Injectable()
export class MetricasLlamadasUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
  ) {}

  execute(organizacionId: string, desde?: Date, hasta?: Date) {
    return this.llamadas.metricas(organizacionId, desde, hasta);
  }
}
