import { Inject, Injectable } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { toConexionResponse } from '../conexion-response.mapper';

@Injectable()
export class ObtenerConexionActualUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY) private readonly conexiones: MetaConexionesRepository,
  ) {}

  async execute(organizacionId: string) {
    const conexion = await this.conexiones.findActivaPorOrganizacion(organizacionId);
    return toConexionResponse(conexion);
  }
}
