import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type { OrganizacionesAdminRepository } from '../ports/organizaciones-admin.repository.port';

@Injectable()
export class DesactivarOrganizacionUseCase {
  constructor(
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
  ) {}

  async execute(id: string, usuarioEdicion: string) {
    const existente = await this.organizaciones.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException('Organización no encontrada');
    }
    return this.organizaciones.desactivar(id, usuarioEdicion);
  }
}
