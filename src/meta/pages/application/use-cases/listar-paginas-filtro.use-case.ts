import { Inject, Injectable } from '@nestjs/common';
import { META_PAGINAS_REPOSITORY } from '../ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';

@Injectable()
export class ListarPaginasFiltroUseCase {
  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
  ) {}

  execute(organizacionId: string) {
    return this.paginas.listarActivasFiltro(organizacionId);
  }
}
