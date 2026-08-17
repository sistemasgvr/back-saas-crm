import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORGANIZACIONES_REPOSITORY } from '../ports/organizaciones.repository.port';
import type { OrganizacionesRepository } from '../ports/organizaciones.repository.port';
import { toOrganizacionResponse } from '../organizacion-response.mapper';

@Injectable()
export class GetOrganizacionActualUseCase {
  constructor(
    @Inject(ORGANIZACIONES_REPOSITORY) private readonly organizaciones: OrganizacionesRepository,
  ) {}

  async execute(organizacionId: string) {
    const org = await this.organizaciones.findActivaById(organizacionId);
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }
    return toOrganizacionResponse(org);
  }
}
