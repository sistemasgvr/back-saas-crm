import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '../ports/dashboard.repository.port';
import type {
  DashboardRepository,
  FiltroDashboard,
} from '../ports/dashboard.repository.port';
import {
  finDiaLimaUtc,
  finMesLima,
  finSemanaLima,
  hoyLima,
  inicioDiaLimaUtc,
  inicioMesLima,
  inicioSemanaLima,
} from '../../../shared/application/lima-time';

@Injectable()
export class ObtenerKpisUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboard: DashboardRepository,
  ) {}

  async execute(organizacionId: string, filtro: FiltroDashboard) {
    const hoy = hoyLima();

    const [total, leadsHoy, leadsSemana, leadsMes] = await Promise.all([
      this.dashboard.contarLeads(organizacionId, filtro),
      this.dashboard.contarLeads(organizacionId, filtro, {
        desde: inicioDiaLimaUtc(hoy),
        hasta: finDiaLimaUtc(hoy),
      }),
      this.dashboard.contarLeads(organizacionId, filtro, {
        desde: inicioDiaLimaUtc(inicioSemanaLima(hoy)),
        hasta: finDiaLimaUtc(finSemanaLima(hoy)),
      }),
      this.dashboard.contarLeads(organizacionId, filtro, {
        desde: inicioDiaLimaUtc(inicioMesLima(hoy)),
        hasta: finDiaLimaUtc(finMesLima(hoy)),
      }),
    ]);

    return { total, hoy: leadsHoy, semana: leadsSemana, mes: leadsMes };
  }
}
