import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INMUEBLES_REPOSITORY,
  type InmueblesRepository,
} from '../ports/inmuebles.repository.port';

@Injectable()
export class EliminarInmuebleUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  async execute(organizacionId: string, id: string, usuarioId: string) {
    const ok = await this.inmuebles.softDelete(
      organizacionId,
      id,
      usuarioId,
    );
    if (!ok) {
      throw new NotFoundException('Inmueble no encontrado');
    }
  }
}
