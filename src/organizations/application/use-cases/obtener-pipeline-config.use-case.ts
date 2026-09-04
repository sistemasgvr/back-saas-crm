import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORGANIZACIONES_REPOSITORY } from '../ports/organizaciones.repository.port';
import type { OrganizacionesRepository } from '../ports/organizaciones.repository.port';
import {
  parsePipelineConfig,
  pipelineConfigPorDefecto,
  type PipelineConfigOverride,
} from '../../../shared/domain/pipeline-inmobiliaria';

export interface PipelineConfigResponse {
  /** Null = la org usa las matrices de código. */
  config: PipelineConfigOverride | null;
  /** Siempre las matrices de código (para UI "restaurar" / comparar). */
  defaults: PipelineConfigOverride;
  usandoOverride: boolean;
}

@Injectable()
export class ObtenerPipelineConfigUseCase {
  constructor(
    @Inject(ORGANIZACIONES_REPOSITORY)
    private readonly organizaciones: OrganizacionesRepository,
  ) {}

  async execute(organizacionId: string): Promise<PipelineConfigResponse> {
    const org = await this.organizaciones.findActivaById(organizacionId);
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }

    const config = parsePipelineConfig(org.pipelineConfig);
    return {
      config,
      defaults: pipelineConfigPorDefecto(),
      usandoOverride: config !== null,
    };
  }
}
