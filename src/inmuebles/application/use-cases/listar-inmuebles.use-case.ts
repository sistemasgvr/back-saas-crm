import { Inject, Injectable } from '@nestjs/common';
import {
  INMUEBLES_REPOSITORY,
  type FiltroInmuebles,
  type InmueblesRepository,
} from '../ports/inmuebles.repository.port';

@Injectable()
export class ListarInmueblesUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  execute(organizacionId: string, filtro: FiltroInmuebles) {
    return this.inmuebles.listar(organizacionId, filtro);
  }
}
