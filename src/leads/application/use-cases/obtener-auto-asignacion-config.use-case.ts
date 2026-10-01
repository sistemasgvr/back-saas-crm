import { Inject, Injectable } from '@nestjs/common';
import {
  LEAD_AUTO_ASIGNACION_REPOSITORY,
  type LeadAutoAsignacionRepository,
} from '../ports/lead-auto-asignacion.repository.port';

export interface AutoAsignacionConfigDto {
  habilitado: boolean;
  usuarioIds: string[];
  siguienteIndice: number;
  limitesDiarios?: Record<string, number>;
  asignadosHoy?: Record<string, number>;
  diaConsumo?: string;
}

@Injectable()
export class ObtenerAutoAsignacionConfigUseCase {
  constructor(
    @Inject(LEAD_AUTO_ASIGNACION_REPOSITORY)
    private readonly repo: LeadAutoAsignacionRepository,
  ) {}

  async execute(organizacionId: string): Promise<AutoAsignacionConfigDto> {
    const cfg = await this.repo.obtenerConfig(organizacionId);
    if (!cfg) {
      return {
        habilitado: false,
        usuarioIds: [],
        siguienteIndice: 0,
      };
    }

    return {
      habilitado: cfg.habilitado,
      usuarioIds: cfg.usuarioIds,
      siguienteIndice: cfg.siguienteIndice,
      limitesDiarios: cfg.limitesDiarios ?? {},
      asignadosHoy: cfg.asignadosHoy ?? {},
      diaConsumo: cfg.diaConsumo,
    };
  }
}
