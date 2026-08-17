import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USUARIOS_ADMIN_REPOSITORY } from '../ports/usuarios-admin.repository.port';
import type { UsuariosAdminRepository } from '../ports/usuarios-admin.repository.port';
import { toUsuarioAdminResponse } from '../usuario-admin-response.mapper';

@Injectable()
export class CambiarEstadoUsuarioUseCase {
  constructor(@Inject(USUARIOS_ADMIN_REPOSITORY) private readonly usuarios: UsuariosAdminRepository) {}

  async execute(id: string, estado: 0 | 1, usuarioEdicion: string) {
    const existente = await this.usuarios.obtenerPorId(id);
    if (!existente) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const actualizado = await this.usuarios.cambiarEstado(id, estado, usuarioEdicion);
    return toUsuarioAdminResponse(actualizado);
  }
}
