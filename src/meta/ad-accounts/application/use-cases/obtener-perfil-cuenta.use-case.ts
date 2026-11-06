import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';
import { META_INSIGHTS_REPOSITORY } from '../../../insights/application/ports/meta-insights.repository.port';
import type { MetaInsightsRepository } from '../../../insights/application/ports/meta-insights.repository.port';

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

    const [totalCampanas, totalLeads, resumenSpend] = await Promise.all([
      this.cuentas.contarCampanas(cuenta.id),
      this.cuentas.contarLeads(cuenta.id),
      this.insights.sumarSpend(organizacionId, { metaCuentaId: cuenta.id }),
    ]);

    return {
      ...cuenta,
      totalCampanas,
      totalLeads,
      spend: resumenSpend.spend,
      cpl: totalLeads > 0 ? resumenSpend.spend / totalLeads : null,
    };
  }
  async listarCampanas(
    organizacionId: string,
    id: string,
    page: number,
    pageSize: number,
  ) {
    const cuenta = await this.cuentas.findPorId(organizacionId, id);
    if (!cuenta)
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    return this.cuentas.listarCampanas(cuenta.id, page, pageSize);
  }
}
