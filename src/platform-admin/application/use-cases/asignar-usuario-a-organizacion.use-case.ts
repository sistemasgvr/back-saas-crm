import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USUARIOS_ADMIN_REPOSITORY } from '../ports/usuarios-admin.repository.port';
import type { UsuariosAdminRepository } from '../ports/usuarios-admin.repository.port';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type { OrganizacionesAdminRepository } from '../ports/organizaciones-admin.repository.port';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { toUsuarioAdminDetalleResponse } from '../usuario-admin-response.mapper';

@Injectable()
export class AsignarUsuarioAOrganizacionUseCase {
  constructor(
    @Inject(USUARIOS_ADMIN_REPOSITORY)
    private readonly usuarios: UsuariosAdminRepository,
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
  ) {}

  async execute(
    usuarioId: string,
    organizacionId: string,
    rol: RolOrganizacion,
    usuarioEdicion: string,
  ) {
    const [usuario, organizacion] = await Promise.all([
      this.usuarios.obtenerPorId(usuarioId),
      this.organizaciones.obtenerPorId(organizacionId),
    ]);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!organizacion)
      throw new NotFoundException('Organización no encontrada');

    await this.usuarios.asignarAOrganizacion(
      usuarioId,
      organizacionId,
      rol,
      usuarioEdicion,
    );

    const actualizado = await this.usuarios.obtenerPorId(usuarioId);
    return toUsuarioAdminDetalleResponse(actualizado!);
  }
}
