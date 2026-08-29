import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type {
  CrearOrganizacionInput,
  OrganizacionesAdminRepository,
} from '../ports/organizaciones-admin.repository.port';
import { USUARIOS_ADMIN_REPOSITORY } from '../ports/usuarios-admin.repository.port';
import type { UsuariosAdminRepository } from '../ports/usuarios-admin.repository.port';
import { PASSWORD_HASHER } from '../../../auth/application/ports/password-hasher.port';
import type { PasswordHasher } from '../../../auth/application/ports/password-hasher.port';

export interface PrimerUsuarioInput {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
}

export interface CrearOrganizacionUseCaseInput extends CrearOrganizacionInput {
  primerUsuario?: PrimerUsuarioInput;
}

@Injectable()
export class CrearOrganizacionUseCase {
  constructor(
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
    @Inject(USUARIOS_ADMIN_REPOSITORY)
    private readonly usuarios: UsuariosAdminRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: CrearOrganizacionUseCaseInput, usuarioCreacion: string) {
    const { primerUsuario, ...datosOrganizacion } = input;

    const org = await this.organizaciones.crearConModulosPorDefecto(
      datosOrganizacion,
      usuarioCreacion,
    );

    if (!primerUsuario) {
      return { organizacion: org, propietario: null };
    }

    const existente = await this.usuarios.buscarActivoPorEmail(
      primerUsuario.email,
    );
    if (existente) {
      throw new ConflictException(
        `Ya existe un usuario activo con el email ${primerUsuario.email}`,
      );
    }

    const passwordHash = await this.hasher.hash(primerUsuario.password);
    const usuario = await this.usuarios.crear(
      {
        email: primerUsuario.email,
        nombre: primerUsuario.nombre,
        apellido: primerUsuario.apellido,
      },
      passwordHash,
      usuarioCreacion,
    );
    await this.usuarios.asignarAOrganizacion(
      usuario.id,
      org.id,
      'PROPIETARIO',
      usuarioCreacion,
    );

    return {
      organizacion: org,
      propietario: { id: usuario.id, email: usuario.email },
    };
  }
}
