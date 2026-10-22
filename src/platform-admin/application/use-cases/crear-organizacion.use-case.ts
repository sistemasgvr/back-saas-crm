import { Inject, Injectable } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type {
  CrearOrganizacionInput,
  OrganizacionesAdminRepository,
} from '../ports/organizaciones-admin.repository.port';
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
    private readonly gestion: GestionMembresiasService,
  ) {}

  async execute(input: CrearOrganizacionUseCaseInput, usuarioCreacion: string) {
    const { primerUsuario, ...datosOrganizacion } = input;

    if (primerUsuario)
      await this.gestion.verificarEmailLibre(primerUsuario.email);
    const org = await this.organizaciones.crearConModulosPorDefecto(
      datosOrganizacion,
      usuarioCreacion,
    );
    if (!primerUsuario) return { organizacion: org, propietario: null };
    const usuario = await this.gestion.crearCuentaPlataforma(
      {
        ...primerUsuario,
        asignacion: { organizacionId: org.id, rol: 'PROPIETARIO' },
      },
      usuarioCreacion,
    );

    return {
      organizacion: org,
      propietario: { id: usuario.id, email: usuario.email },
    };
  }
}
