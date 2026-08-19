import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';

@Injectable()
export class DesvincularCuentaUseCase {
  constructor(
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<void> {
    const desvinculada = await this.cuentas.desvincular(
      organizacionId,
      id,
      usuarioEdicion,
    );
    if (!desvinculada) {
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    }
  }
}
