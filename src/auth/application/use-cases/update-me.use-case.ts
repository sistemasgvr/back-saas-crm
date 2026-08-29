import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { USUARIOS_REPOSITORY } from '../ports/usuarios.repository.port';
import type { UsuariosRepository } from '../ports/usuarios.repository.port';

@Injectable()
export class UpdateMeUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY) private readonly usuarios: UsuariosRepository,
  ) {}

  async execute(
    usuarioId: string,
    data: { nombre?: string; apellido?: string; telefono?: string },
  ) {
    const usuario = await this.usuarios.findActivoById(usuarioId);
    if (!usuario) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const actualizado = await this.usuarios.actualizarPerfil(
      usuarioId,
      {
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono,
      },
      usuarioId,
    );

    return {
      id: actualizado.id,
      email: actualizado.email,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      telefono: actualizado.telefono,
      esAdminPlataforma: actualizado.esAdminPlataforma === 1,
    };
  }
}
