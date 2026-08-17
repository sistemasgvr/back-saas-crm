import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type { OrganizacionesAdminRepository } from '../ports/organizaciones-admin.repository.port';
import { ORGANIZACION_MODULOS_ADMIN_REPOSITORY } from '../ports/organizacion-modulos-admin.repository.port';
import type { OrganizacionModulosAdminRepository } from '../ports/organizacion-modulos-admin.repository.port';

@Injectable()
export class ListarMatrizModulosOrganizacionUseCase {
  constructor(
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
    @Inject(ORGANIZACION_MODULOS_ADMIN_REPOSITORY)
    private readonly organizacionModulos: OrganizacionModulosAdminRepository,
  ) {}

  async execute(organizacionId: string) {
    const organizacion = await this.organizaciones.obtenerPorId(organizacionId);
    if (!organizacion) {
      throw new NotFoundException('Organización no encontrada');
    }
    return this.organizacionModulos.listarMatrizPorOrganizacion(organizacionId);
  }
}
