import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type { OrganizacionesAdminRepository } from '../ports/organizaciones-admin.repository.port';

@Injectable()
export class ObtenerOrganizacionUseCase {
  constructor(
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
  ) {}

  async execute(id: string) {
    const org = await this.organizaciones.obtenerPorId(id);
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }
    return org;
  }
}
