import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type { WhatsappLlamadasRepository } from '../ports/whatsapp-llamadas.repository.port';

@Injectable()
export class ObtenerLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
  ) {}

  async execute(organizacionId: string, id: string) {
    const llamada = await this.llamadas.findPorId(organizacionId, id);
    if (!llamada) {
      throw new NotFoundException('Llamada no encontrada');
    }
    return llamada;
  }
}
