import { Injectable } from '@nestjs/common';
import { LlamadaPresenciaService } from '../../infrastructure/llamada-presencia.service';

@Injectable()
export class SetPresenciaLlamadasUseCase {
  constructor(private readonly presencia: LlamadaPresenciaService) {}

  execute(
    organizacionId: string,
    usuarioId: string,
    disponible: boolean,
  ) {
    this.presencia.setDisponible(organizacionId, usuarioId, disponible);
    return {
      disponible: this.presencia.isDisponible(organizacionId, usuarioId),
      disponibles: this.presencia.listDisponibles(organizacionId),
    };
  }
}
