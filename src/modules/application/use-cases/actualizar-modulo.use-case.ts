import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MODULOS_CATALOGO_REPOSITORY } from '../ports/modulos-catalogo.repository.port';
import type {
  ActualizarModuloInput,
  ModulosCatalogoRepository,
} from '../ports/modulos-catalogo.repository.port';

@Injectable()
export class ActualizarModuloUseCase {
  constructor(
    @Inject(MODULOS_CATALOGO_REPOSITORY)
    private readonly modulos: ModulosCatalogoRepository,
  ) {}

  async execute(
    id: string,
    input: ActualizarModuloInput,
    usuarioEdicion: string,
  ) {
    const existente = await this.modulos.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException('Módulo no encontrado');
    }
    return this.modulos.actualizar(id, input, usuarioEdicion);
  }
}
