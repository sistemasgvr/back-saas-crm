import { Inject, Injectable } from '@nestjs/common';
import {
  USUARIOS_ADMIN_REPOSITORY,
  type FiltroListadoUsuarios,
  type UsuariosAdminRepository,
} from '../ports/usuarios-admin.repository.port';
import { toUsuarioAdminResponse } from '../usuario-admin-response.mapper';

@Injectable()
export class ListarUsuariosUseCase {
  constructor(@Inject(USUARIOS_ADMIN_REPOSITORY) private readonly usuarios: UsuariosAdminRepository) {}

  async execute(filtro: FiltroListadoUsuarios) {
    const resultado = await this.usuarios.listar(filtro);
    return { ...resultado, data: resultado.data.map(toUsuarioAdminResponse) };
  }
}
