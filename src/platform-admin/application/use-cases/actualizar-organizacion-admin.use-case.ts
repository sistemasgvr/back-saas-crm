import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type {
  ActualizarOrganizacionAdminInput,
  OrganizacionesAdminRepository,
} from '../ports/organizaciones-admin.repository.port';

@Injectable()
export class ActualizarOrganizacionAdminUseCase {
  constructor(
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
  ) {}

  async execute(
    id: string,
    input: ActualizarOrganizacionAdminInput,
    usuarioEdicion: string,
  ) {
    const existente = await this.organizaciones.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException('Organización no encontrada');
    }
    return this.organizaciones.actualizar(id, input, usuarioEdicion);
  }
}
