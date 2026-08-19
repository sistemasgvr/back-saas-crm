import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';

const ULTIMAS_CAMPANAS_LIMITE = 10;

@Injectable()
export class ObtenerPerfilCuentaUseCase {
  constructor(
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
  ) {}

  async execute(organizacionId: string, id: string) {
    const cuenta = await this.cuentas.findPorId(organizacionId, id);
    if (!cuenta) {
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    }

    const [totalCampanas, totalLeads, ultimasCampanas] = await Promise.all([
      this.cuentas.contarCampanas(cuenta.id),
      this.cuentas.contarLeads(cuenta.id),
      this.cuentas.listarUltimasCampanas(cuenta.id, ULTIMAS_CAMPANAS_LIMITE),
    ]);

    return { ...cuenta, totalCampanas, totalLeads, ultimasCampanas };
  }
}
