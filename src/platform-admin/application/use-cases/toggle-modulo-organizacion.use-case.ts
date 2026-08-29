import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type { OrganizacionesAdminRepository } from '../ports/organizaciones-admin.repository.port';
import { ORGANIZACION_MODULOS_ADMIN_REPOSITORY } from '../ports/organizacion-modulos-admin.repository.port';
import type { OrganizacionModulosAdminRepository } from '../ports/organizacion-modulos-admin.repository.port';
import { MODULOS_CATALOGO_REPOSITORY } from '../../../modules/application/ports/modulos-catalogo.repository.port';
import type { ModulosCatalogoRepository } from '../../../modules/application/ports/modulos-catalogo.repository.port';

@Injectable()
export class ToggleModuloOrganizacionUseCase {
  constructor(
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
    @Inject(MODULOS_CATALOGO_REPOSITORY)
    private readonly modulos: ModulosCatalogoRepository,
    @Inject(ORGANIZACION_MODULOS_ADMIN_REPOSITORY)
    private readonly organizacionModulos: OrganizacionModulosAdminRepository,
  ) {}

  async execute(
    organizacionId: string,
    moduloId: string,
    habilitado: boolean,
    usuarioEdicion: string,
  ) {
    const [organizacion, modulo] = await Promise.all([
      this.organizaciones.obtenerPorId(organizacionId),
      this.modulos.obtenerPorId(moduloId),
    ]);
    if (!organizacion)
      throw new NotFoundException('Organización no encontrada');
    if (!modulo) throw new NotFoundException('Módulo no encontrado');

    await this.organizacionModulos.toggle(
      organizacionId,
      moduloId,
      habilitado,
      usuarioEdicion,
    );
    return this.organizacionModulos.listarMatrizPorOrganizacion(organizacionId);
  }
}
