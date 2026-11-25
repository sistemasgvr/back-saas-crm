import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ORGANIZACIONES_REPOSITORY } from '../ports/organizaciones.repository.port';
import type { OrganizacionesRepository } from '../ports/organizaciones.repository.port';
import {
  calcularReubicaciones,
  parsePipelineConfig,
  pipelineConfigPorDefecto,
  validarPipelineConfig,
  type PipelineConfigOverride,
  type ReubicacionEstado,
} from '../../../shared/domain/pipeline-inmobiliaria';

export interface ImpactoEstado extends ReubicacionEstado {
  cantidad: number;
}

/** Reubicaciones que provoca pasar de la config guardada a `nuevo`. */
export async function reubicacionesParaConfig(
  organizaciones: OrganizacionesRepository,
  organizacionId: string,
  nuevo: PipelineConfigOverride,
): Promise<ReubicacionEstado[]> {
  const anterior =
    parsePipelineConfig(
      await organizaciones.obtenerPipelineConfig(organizacionId),
    ) ?? pipelineConfigPorDefecto();
  return calcularReubicaciones(anterior, nuevo);
}

/** Cuántos leads se verían afectados (y a dónde irían) si se guardara `config`
 * (null = restaurar defaults). Solo lectura: no modifica nada. */
@Injectable()
export class ImpactoPipelineConfigUseCase {
  constructor(
    @Inject(ORGANIZACIONES_REPOSITORY)
    private readonly organizaciones: OrganizacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    config: unknown,
  ): Promise<{ impactos: ImpactoEstado[] }> {
    let nuevo: PipelineConfigOverride;
    if (config === null) {
      nuevo = pipelineConfigPorDefecto();
    } else {
      try {
        nuevo = validarPipelineConfig(config, true);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'pipeline_config inválido',
        );
      }
    }

    const reubicaciones = await reubicacionesParaConfig(
      this.organizaciones,
      organizacionId,
      nuevo,
    );
    const impactos: ImpactoEstado[] = [];
    for (const r of reubicaciones) {
      const cantidad = await this.organizaciones.contarLeadsEnEstado(
        organizacionId,
        r.tipoLead,
        r.desde,
      );
      if (cantidad > 0) impactos.push({ ...r, cantidad });
    }
    return { impactos };
  }
}
