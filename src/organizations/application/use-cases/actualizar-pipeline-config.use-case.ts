import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ORGANIZACIONES_REPOSITORY } from '../ports/organizaciones.repository.port';
import type { OrganizacionesRepository } from '../ports/organizaciones.repository.port';
import {
  parsePipelineConfig,
  pipelineConfigPorDefecto,
  validarPipelineConfig,
  type PipelineConfigOverride,
} from '../../../shared/domain/pipeline-inmobiliaria';
import type { PipelineConfigResponse } from './obtener-pipeline-config.use-case';

@Injectable()
export class ActualizarPipelineConfigUseCase {
  constructor(
    @Inject(ORGANIZACIONES_REPOSITORY)
    private readonly organizaciones: OrganizacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    usuarioEdicion: string,
    /** Null restaura defaults (borra el override). */
    config: unknown | null,
  ): Promise<PipelineConfigResponse> {
    const org = await this.organizaciones.findActivaById(organizacionId);
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }

    if (config === undefined) {
      throw new BadRequestException(
        'Debes enviar config (objeto) o null para restaurar defaults',
      );
    }

    if (config === null) {
      await this.organizaciones.actualizarPipelineConfig(
        organizacionId,
        null,
        usuarioEdicion,
      );
      return {
        config: null,
        defaults: pipelineConfigPorDefecto(),
        usandoOverride: false,
      };
    }

    let normalizado: PipelineConfigOverride;
    try {
      normalizado = validarPipelineConfig(config);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'pipeline_config inválido',
      );
    }

    await this.organizaciones.actualizarPipelineConfig(
      organizacionId,
      normalizado as unknown as Prisma.InputJsonValue,
      usuarioEdicion,
    );

    return {
      config: parsePipelineConfig(normalizado),
      defaults: pipelineConfigPorDefecto(),
      usandoOverride: true,
    };
  }
}
