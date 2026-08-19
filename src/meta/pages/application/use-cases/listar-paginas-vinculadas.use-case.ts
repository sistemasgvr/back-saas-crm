import { Inject, Injectable } from '@nestjs/common';
import { META_PAGINAS_REPOSITORY } from '../ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../ports/meta-paginas.repository.port';

@Injectable()
export class ListarPaginasVinculadasUseCase {
  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
  ) {}

  execute(organizacionId: string, page: number, pageSize: number) {
    return this.paginas.listarPorOrganizacion(organizacionId, page, pageSize);
  }
}
