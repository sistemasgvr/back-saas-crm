import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { MODULOS_CATALOGO_REPOSITORY } from '../ports/modulos-catalogo.repository.port';
import type {
  CrearModuloInput,
  ModulosCatalogoRepository,
} from '../ports/modulos-catalogo.repository.port';

@Injectable()
export class CrearModuloUseCase {
  constructor(
    @Inject(MODULOS_CATALOGO_REPOSITORY)
    private readonly modulos: ModulosCatalogoRepository,
  ) {}

  async execute(input: CrearModuloInput, usuarioCreacion: string) {
    const existente = await this.modulos.obtenerPorCodigo(input.codigo);
    if (existente) {
      throw new ConflictException(
        `Ya existe un módulo con código ${input.codigo}`,
      );
    }
    return this.modulos.crear(input, usuarioCreacion);
  }
}
