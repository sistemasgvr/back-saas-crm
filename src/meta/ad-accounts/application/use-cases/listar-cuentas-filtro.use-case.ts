import { Inject, Injectable } from '@nestjs/common';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';

@Injectable()
export class ListarCuentasFiltroUseCase {
  constructor(
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
  ) {}

  execute(organizacionId: string) {
    return this.cuentas.listarActivasFiltro(organizacionId);
  }
}
