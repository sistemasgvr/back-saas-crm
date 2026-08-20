import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';
import { META_INSIGHTS_REPOSITORY } from '../../../insights/application/ports/meta-insights.repository.port';
import type { MetaInsightsRepository } from '../../../insights/application/ports/meta-insights.repository.port';

const ULTIMAS_CAMPANAS_LIMITE = 10;

@Injectable()
export class ObtenerPerfilCuentaUseCase {
  constructor(
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
    @Inject(META_INSIGHTS_REPOSITORY)
    private readonly insights: MetaInsightsRepository,
  ) {}

  async execute(organizacionId: string, id: string) {
    const cuenta = await this.cuentas.findPorId(organizacionId, id);
    if (!cuenta) {
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    }

    const [totalCampanas, totalLeads, ultimasCampanas, resumenSpend] =
      await Promise.all([
        this.cuentas.contarCampanas(cuenta.id),
        this.cuentas.contarLeads(cuenta.id),
        this.cuentas.listarUltimasCampanas(cuenta.id, ULTIMAS_CAMPANAS_LIMITE),
        this.insights.sumarSpend(organizacionId, { metaCuentaId: cuenta.id }),
      ]);

    return {
      ...cuenta,
      totalCampanas,
      totalLeads,
      ultimasCampanas,
      spend: resumenSpend.spend,
      cpl: totalLeads > 0 ? resumenSpend.spend / totalLeads : null,
    };
  }
}
