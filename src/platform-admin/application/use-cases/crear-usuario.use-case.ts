import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { USUARIOS_ADMIN_REPOSITORY } from '../ports/usuarios-admin.repository.port';
import type {
  CrearUsuarioInput,
  UsuariosAdminRepository,
} from '../ports/usuarios-admin.repository.port';
import { PASSWORD_HASHER } from '../../../auth/application/ports/password-hasher.port';
import type { PasswordHasher } from '../../../auth/application/ports/password-hasher.port';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { toUsuarioAdminResponse } from '../usuario-admin-response.mapper';

export interface AsignacionInicial {
  organizacionId: string;
  rol: RolOrganizacion;
}

export interface CrearUsuarioUseCaseInput extends CrearUsuarioInput {
  password: string;
  asignacion?: AsignacionInicial;
}

@Injectable()
export class CrearUsuarioUseCase {
  constructor(
    @Inject(USUARIOS_ADMIN_REPOSITORY)
    private readonly usuarios: UsuariosAdminRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: CrearUsuarioUseCaseInput, usuarioCreacion: string) {
    const existente = await this.usuarios.buscarActivoPorEmail(input.email);
    if (existente) {
      throw new ConflictException(
        `Ya existe un usuario activo con el email ${input.email}`,
      );
    }

    const { password, asignacion, ...datosUsuario } = input;
    const passwordHash = await this.hasher.hash(password);
    const usuario = await this.usuarios.crear(
      datosUsuario,
      passwordHash,
      usuarioCreacion,
    );

    if (asignacion) {
      await this.usuarios.asignarAOrganizacion(
        usuario.id,
        asignacion.organizacionId,
        asignacion.rol,
        usuarioCreacion,
      );
    }

    return toUsuarioAdminResponse(usuario);
  }
}
