import { Inject, Injectable } from '@nestjs/common';
import { ORGANIZACIONES_REPOSITORY } from '../ports/organizaciones.repository.port';
import type {
  ActualizarOrganizacionInput,
  OrganizacionesRepository,
} from '../ports/organizaciones.repository.port';
import { toOrganizacionResponse } from '../organizacion-response.mapper';

@Injectable()
export class ActualizarOrganizacionActualUseCase {
  constructor(
    @Inject(ORGANIZACIONES_REPOSITORY) private readonly organizaciones: OrganizacionesRepository,
  ) {}

  async execute(organizacionId: string, usuarioEdicion: string, input: ActualizarOrganizacionInput) {
    const actualizada = await this.organizaciones.actualizar(organizacionId, input, usuarioEdicion);
    return toOrganizacionResponse(actualizada);
  }
}
