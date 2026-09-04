import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INMUEBLES_REPOSITORY,
  type InmueblesRepository,
} from '../ports/inmuebles.repository.port';
import {
  rankearInteresados,
  type InteresadoRankeado,
} from '../../domain/ranking-interesados';

@Injectable()
export class ListarInteresadosInmuebleUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  async execute(
    organizacionId: string,
    inmuebleId: string,
  ): Promise<InteresadoRankeado[]> {
    const inmueble = await this.inmuebles.obtenerPorId(
      organizacionId,
      inmuebleId,
    );
    if (!inmueble) {
      throw new NotFoundException('Inmueble no encontrado');
    }

    const candidatos = await this.inmuebles.listarCandidatosInteres(
      organizacionId,
      inmuebleId,
    );

    return rankearInteresados(candidatos, inmueble.operacion);
  }
}
