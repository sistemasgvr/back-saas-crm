import { Inject, Injectable } from '@nestjs/common';
import { META_FORMULARIOS_REPOSITORY } from '../ports/meta-formularios.repository.port';
import type { MetaFormulariosRepository } from '../ports/meta-formularios.repository.port';

@Injectable()
export class ListarFormulariosPaginaUseCase {
  constructor(
    @Inject(META_FORMULARIOS_REPOSITORY)
    private readonly formularios: MetaFormulariosRepository,
  ) {}

  execute(organizacionId: string, metaPaginaId: string) {
    return this.formularios.listarPorPagina(organizacionId, metaPaginaId);
  }
}
