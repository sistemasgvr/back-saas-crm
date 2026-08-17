import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';

@Injectable()
export class DesconectarUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY) private readonly conexiones: MetaConexionesRepository,
  ) {}

  async execute(organizacionId: string, usuarioEdicion: string): Promise<void> {
    const conexion = await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new NotFoundException('No hay una conexión Meta activa');
    }
    await this.conexiones.desactivar(conexion.id, usuarioEdicion);
  }
}
