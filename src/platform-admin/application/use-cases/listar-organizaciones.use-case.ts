import { Inject, Injectable } from '@nestjs/common';
import { ORGANIZACIONES_ADMIN_REPOSITORY } from '../ports/organizaciones-admin.repository.port';
import type { OrganizacionesAdminRepository } from '../ports/organizaciones-admin.repository.port';

@Injectable()
export class ListarOrganizacionesUseCase {
  constructor(
    @Inject(ORGANIZACIONES_ADMIN_REPOSITORY)
    private readonly organizaciones: OrganizacionesAdminRepository,
  ) {}

  execute() {
    return this.organizaciones.listar();
  }
}
