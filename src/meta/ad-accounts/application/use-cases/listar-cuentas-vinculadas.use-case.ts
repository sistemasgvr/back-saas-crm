import { Inject, Injectable } from '@nestjs/common';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';

@Injectable()
export class ListarCuentasVinculadasUseCase {
  constructor(
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
  ) {}

  execute(organizacionId: string, page: number, pageSize: number) {
    return this.cuentas.listarPorOrganizacion(organizacionId, page, pageSize);
  }
}
