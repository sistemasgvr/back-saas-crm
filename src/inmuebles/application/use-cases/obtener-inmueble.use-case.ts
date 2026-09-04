import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INMUEBLES_REPOSITORY,
  type InmueblesRepository,
} from '../ports/inmuebles.repository.port';

@Injectable()
export class ObtenerInmuebleUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  async execute(organizacionId: string, id: string) {
    const row = await this.inmuebles.obtenerPorId(organizacionId, id);
    if (!row) {
      throw new NotFoundException('Inmueble no encontrado');
    }
    return row;
  }
}
