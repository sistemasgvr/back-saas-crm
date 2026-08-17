import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USUARIOS_ADMIN_REPOSITORY } from '../ports/usuarios-admin.repository.port';
import type { UsuariosAdminRepository } from '../ports/usuarios-admin.repository.port';
import { toUsuarioAdminDetalleResponse } from '../usuario-admin-response.mapper';

@Injectable()
export class ObtenerUsuarioUseCase {
  constructor(@Inject(USUARIOS_ADMIN_REPOSITORY) private readonly usuarios: UsuariosAdminRepository) {}

  async execute(id: string) {
    const usuario = await this.usuarios.obtenerPorId(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return toUsuarioAdminDetalleResponse(usuario);
  }
}
