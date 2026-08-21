import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';

@Injectable()
export class DesvincularNumeroUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
  ) {}

  async execute(organizacionId: string, id: string, usuarioEdicion: string) {
    const eliminado = await this.whatsappConexiones.desvincular(
      organizacionId,
      id,
      usuarioEdicion,
    );
    if (!eliminado) {
      throw new NotFoundException('Número de WhatsApp no encontrado');
    }
  }
}
