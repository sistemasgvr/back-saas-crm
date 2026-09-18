import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type {
  FiltroListarLlamadas,
  WhatsappLlamadasRepository,
} from '../ports/whatsapp-llamadas.repository.port';

@Injectable()
export class ListarLlamadasUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
  ) {}

  execute(organizacionId: string, filtro: FiltroListarLlamadas) {
    return this.llamadas.listar(organizacionId, filtro);
  }
}
