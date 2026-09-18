import { Injectable } from '@nestjs/common';
import { LlamadaPresenciaService } from '../../infrastructure/llamada-presencia.service';

@Injectable()
export class GetPresenciaLlamadasUseCase {
  constructor(private readonly presencia: LlamadaPresenciaService) {}

  execute(organizacionId: string, usuarioId: string) {
    return {
      disponible: this.presencia.isDisponible(organizacionId, usuarioId),
      disponibles: this.presencia.listDisponibles(organizacionId),
    };
  }
}
