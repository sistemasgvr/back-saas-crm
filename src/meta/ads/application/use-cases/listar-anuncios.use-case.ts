import { Inject, Injectable } from '@nestjs/common';
import { ANUNCIOS_REPOSITORY } from '../ports/anuncios.repository.port';
import type { AnunciosRepository } from '../ports/anuncios.repository.port';

@Injectable()
export class ListarAnunciosUseCase {
  constructor(
    @Inject(ANUNCIOS_REPOSITORY) private readonly anuncios: AnunciosRepository,
  ) {}

  execute(organizacionId: string, conjuntoAnuncioId?: string) {
    return this.anuncios.listarPorOrganizacion(
      organizacionId,
      conjuntoAnuncioId,
    );
  }
}
