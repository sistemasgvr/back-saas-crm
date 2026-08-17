import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { toConexionResponse } from '../conexion-response.mapper';

@Injectable()
export class SeleccionarCuentaPublicitariaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY) private readonly conexiones: MetaConexionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    adAccountId: string,
    adAccountNombre: string,
    usuarioEdicion: string,
  ) {
    const conexion = await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new BadRequestException('No hay una conexión Meta activa. Conecta Meta primero.');
    }

    const actualizada = await this.conexiones.actualizarCuentaPublicitaria(
      conexion.id,
      adAccountId,
      adAccountNombre,
      usuarioEdicion,
    );
    return toConexionResponse(actualizada);
  }
}
