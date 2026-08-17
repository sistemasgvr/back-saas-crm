import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { USUARIOS_REPOSITORY } from '../ports/usuarios.repository.port';
import type { UsuariosRepository } from '../ports/usuarios.repository.port';
import { PASSWORD_HASHER } from '../ports/password-hasher.port';
import type { PasswordHasher } from '../ports/password-hasher.port';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USUARIOS_REPOSITORY) private readonly usuarios: UsuariosRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(usuarioId: string, passwordActual: string, passwordNueva: string): Promise<void> {
    const usuario = await this.usuarios.findActivoById(usuarioId);
    if (!usuario) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const ok = await this.hasher.compare(passwordActual, usuario.passwordHash);
    if (!ok) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const hash = await this.hasher.hash(passwordNueva);
    await this.usuarios.actualizarPasswordHash(usuarioId, hash, usuarioId);
  }
}
