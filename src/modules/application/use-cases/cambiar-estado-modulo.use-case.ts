import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MODULOS_CATALOGO_REPOSITORY } from '../ports/modulos-catalogo.repository.port';
import type { ModulosCatalogoRepository } from '../ports/modulos-catalogo.repository.port';

@Injectable()
export class CambiarEstadoModuloUseCase {
  constructor(
    @Inject(MODULOS_CATALOGO_REPOSITORY) private readonly modulos: ModulosCatalogoRepository,
  ) {}

  async execute(id: string, estado: 0 | 1, usuarioEdicion: string) {
    const existente = await this.modulos.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException('Módulo no encontrado');
    }
    return this.modulos.cambiarEstado(id, estado, usuarioEdicion);
  }
}
