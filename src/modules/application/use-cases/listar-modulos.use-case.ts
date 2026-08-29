import { Inject, Injectable } from '@nestjs/common';
import { MODULOS_CATALOGO_REPOSITORY } from '../ports/modulos-catalogo.repository.port';
import type { ModulosCatalogoRepository } from '../ports/modulos-catalogo.repository.port';

@Injectable()
export class ListarModulosUseCase {
  constructor(
    @Inject(MODULOS_CATALOGO_REPOSITORY)
    private readonly modulos: ModulosCatalogoRepository,
  ) {}

  execute() {
    return this.modulos.listar();
  }
}
