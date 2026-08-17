import { Inject, Injectable } from '@nestjs/common';
import { CAMPANAS_REPOSITORY } from '../ports/campanas.repository.port';
import type { CampanasRepository } from '../ports/campanas.repository.port';

@Injectable()
export class ListarCampanasUseCase {
  constructor(
    @Inject(CAMPANAS_REPOSITORY) private readonly campanas: CampanasRepository,
  ) {}

  execute(organizacionId: string) {
    return this.campanas.listarPorOrganizacion(organizacionId);
  }
}
