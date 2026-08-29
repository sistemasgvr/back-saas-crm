import { Inject, Injectable } from '@nestjs/common';
import { CONJUNTOS_ANUNCIOS_REPOSITORY } from '../ports/conjuntos-anuncios.repository.port';
import type { ConjuntosAnunciosRepository } from '../ports/conjuntos-anuncios.repository.port';

@Injectable()
export class ListarConjuntosAnunciosUseCase {
  constructor(
    @Inject(CONJUNTOS_ANUNCIOS_REPOSITORY)
    private readonly conjuntosAnuncios: ConjuntosAnunciosRepository,
  ) {}

  execute(organizacionId: string, campanaId?: string) {
    return this.conjuntosAnuncios.listarPorOrganizacion(
      organizacionId,
      campanaId,
    );
  }
}
