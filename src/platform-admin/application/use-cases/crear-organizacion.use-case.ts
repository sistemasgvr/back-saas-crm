import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type {
  CrearOrganizacionInput,
  OrganizacionesAdminRepository,
} from '../ports/organizaciones-admin.repository.port';
import { USUARIOS_ADMIN_REPOSITORY } from '../ports/usuarios-admin.repository.port';
import type { UsuariosAdminRepository } from '../ports/usuarios-admin.repository.port';
import { GestionMembresiasService } from '../../../organizations/application/gestion-membresias.service';

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
    private readonly gestion: GestionMembresiasService,
  ) {}

  async execute(input: CrearOrganizacionUseCaseInput, usuarioCreacion: string) {
    const { primerUsuario, ...datosOrganizacion } = input;

    if (primerUsuario) {
      const existente = await this.usuarios.buscarActivoPorEmail(primerUsuario.email);
      if (existente) {
        throw new ConflictException('Este email no está disponible. Contacta a soporte.');
      }
    }
    const org = await this.organizaciones.crearConModulosPorDefecto(
      datosOrganizacion, usuarioCreacion,
    );
    if (!primerUsuario) return { organizacion: org, propietario: null };
    const usuario = await this.gestion.crearCuentaPlataforma(
      { ...primerUsuario, asignacion: { organizacionId: org.id, rol: 'PROPIETARIO' } },
      usuarioCreacion,
    );

    return {
      organizacion: org,
      propietario: { id: usuario.id, email: usuario.email },
    };
  }
}
