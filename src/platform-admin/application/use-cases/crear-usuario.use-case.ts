import { Injectable } from '@nestjs/common';
import type { CrearUsuarioInput } from '../ports/usuarios-admin.repository.port';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { toUsuarioAdminResponse } from '../usuario-admin-response.mapper';
import { GestionMembresiasService } from '../../../organizations/application/gestion-membresias.service';

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
    private readonly gestion: GestionMembresiasService,
  ) {}

  async execute(input: CrearUsuarioUseCaseInput, usuarioCreacion: string) {
    const usuario = await this.gestion.crearCuentaPlataforma(
      input,
      usuarioCreacion,
    );
    return toUsuarioAdminResponse(usuario);
  }
}
