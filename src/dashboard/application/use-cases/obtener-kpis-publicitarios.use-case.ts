import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '../ports/dashboard.repository.port';
import type {
  DashboardRepository,
  FiltroDashboard,
} from '../ports/dashboard.repository.port';
import { META_INSIGHTS_REPOSITORY } from '../../../meta/insights/application/ports/meta-insights.repository.port';
import type { MetaInsightsRepository } from '../../../meta/insights/application/ports/meta-insights.repository.port';
import {
  finDiaLimaUtc,
  finMesLima,
  hoyLima,
  inicioDiaLimaUtc,
  inicioMesLima,
} from '../../../shared/application/lima-time';

export interface ObtenerKpisPublicitariosInput extends FiltroDashboard {
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface KpisPublicitarios {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  leads: number;
  moneda: string | null;
}

/** Combina Insights (spend/impressions/clicks) con el conteo de leads del CRM
 * para el CPL híbrido (PLAN.md Fase 15). Sin breakdown por
 * conjunto/anuncio: Insights solo se sincroniza a nivel cuenta/campaña. */
@Injectable()
export class ObtenerKpisPublicitariosUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboard: DashboardRepository,
    @Inject(META_INSIGHTS_REPOSITORY)
    private readonly insights: MetaInsightsRepository,
  ) {}

  async execute(
    organizacionId: string,
    input: ObtenerKpisPublicitariosInput,
  ): Promise<KpisPublicitarios> {
    const hoy = hoyLima();
    const fechaDesde = input.fechaDesde ?? inicioMesLima(hoy);
    const fechaHasta = input.fechaHasta ?? finMesLima(hoy);
    const rango = {
      desde: inicioDiaLimaUtc(fechaDesde),
      hasta: finDiaLimaUtc(fechaHasta),
    };

    const filtro: FiltroDashboard = {
      campanaId: input.campanaId,
      conjuntoAnuncioId: input.conjuntoAnuncioId,
      anuncioId: input.anuncioId,
      metaCuentaId: input.metaCuentaId,
      inmuebleId: input.inmuebleId,
    };

    const leads = await this.dashboard.contarLeads(
      organizacionId,
      filtro,
      rango,
    );

    if (filtro.conjuntoAnuncioId || filtro.anuncioId) {
      return {
        spend: null,
        impressions: null,
        clicks: null,
        ctr: null,
        cpc: null,
        cpl: null,
        leads,
        moneda: null,
      };
    }

    const resumen = await this.insights.sumarSpend(organizacionId, {
      metaCuentaId: filtro.metaCuentaId,
      campanaId: filtro.campanaId,
      desde: rango.desde,
      hasta: rango.hasta,
    });

    return {
      spend: resumen.spend,
      impressions: resumen.impressions,
      clicks: resumen.clicks,
      ctr:
        resumen.impressions > 0
          ? (resumen.clicks / resumen.impressions) * 100
          : null,
      cpc: resumen.clicks > 0 ? resumen.spend / resumen.clicks : null,
      cpl: leads > 0 ? resumen.spend / leads : null,
      leads,
      moneda: resumen.moneda,
    };
  }
}
