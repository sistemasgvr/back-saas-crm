import { Inject, Injectable } from '@nestjs/common';
import { META_INSIGHTS_REPOSITORY } from '../../../meta/insights/application/ports/meta-insights.repository.port';
import type { MetaInsightsRepository } from '../../../meta/insights/application/ports/meta-insights.repository.port';
import {
  finMesLima,
  hoyLima,
  inicioMesLima,
} from '../../../shared/application/lima-time';
import type { ObtenerKpisPublicitariosInput } from './obtener-kpis-publicitarios.use-case';

export interface PuntoSpendDia {
  fecha: string;
  spend: number;
}

@Injectable()
export class ObtenerSeriesPublicitariasUseCase {
  constructor(
    @Inject(META_INSIGHTS_REPOSITORY)
    private readonly insights: MetaInsightsRepository,
  ) {}

  async execute(
    organizacionId: string,
    input: ObtenerKpisPublicitariosInput,
  ): Promise<{ porDia: PuntoSpendDia[] }> {
    if (input.conjuntoAnuncioId || input.anuncioId) {
      return { porDia: [] };
    }

    const hoy = hoyLima();
    const fechaDesde = input.fechaDesde ?? inicioMesLima(hoy);
    const fechaHasta = input.fechaHasta ?? finMesLima(hoy);

    const porDia = await this.insights.serieDiariaSpend(
      organizacionId,
      {
        metaCuentaId: input.metaCuentaId,
        campanaId: input.campanaId,
        desde: new Date(`${fechaDesde}T00:00:00.000Z`),
        hasta: new Date(`${fechaHasta}T00:00:00.000Z`),
      },
      fechaDesde,
      fechaHasta,
    );

    return { porDia };
  }
}
