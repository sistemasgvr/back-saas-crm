import { Inject, Injectable } from '@nestjs/common';
import { USUARIOS_ADMIN_REPOSITORY } from '../ports/usuarios-admin.repository.port';
import type { UsuariosAdminRepository } from '../ports/usuarios-admin.repository.port';
import { toUsuarioAdminResponse } from '../usuario-admin-response.mapper';

@Injectable()
export class ListarUsuariosUseCase {
  constructor(@Inject(USUARIOS_ADMIN_REPOSITORY) private readonly usuarios: UsuariosAdminRepository) {}

  async execute() {
    const usuarios = await this.usuarios.listar();
    return usuarios.map(toUsuarioAdminResponse);
  }
}
