import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type { WhatsappLlamadasRepository } from '../ports/whatsapp-llamadas.repository.port';

@Injectable()
export class ActualizarLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    campos: { notaPostLlamada?: string; motivo?: string },
  ) {
    const actualizada = await this.llamadas.actualizar(organizacionId, id, {
      ...(campos.notaPostLlamada !== undefined
        ? { notaPostLlamada: campos.notaPostLlamada }
        : {}),
      ...(campos.motivo !== undefined ? { motivo: campos.motivo } : {}),
    });
    if (!actualizada) {
      throw new NotFoundException('Llamada no encontrada');
    }
    return actualizada;
  }
}
