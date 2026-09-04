import { Inject, Injectable } from '@nestjs/common';
import {
  INMUEBLES_REPOSITORY,
  type InmueblesRepository,
} from '../ports/inmuebles.repository.port';

@Injectable()
export class ListarInmueblesFiltroUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  execute(organizacionId: string) {
    return this.inmuebles.listarFiltro(organizacionId);
  }
}
