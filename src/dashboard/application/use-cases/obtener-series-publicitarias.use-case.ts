import { Inject, Injectable } from '@nestjs/common';
import { META_INSIGHTS_REPOSITORY } from '../../../meta/insights/application/ports/meta-insights.repository.port';
import type {
  MetaInsightsRepository,
  SerieSpendCuenta,
} from '../../../meta/insights/application/ports/meta-insights.repository.port';
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

export interface SeriesPublicitariasResult {
  porDia: PuntoSpendDia[];
  /** Presente solo cuando no hay filtro de cuenta ni campaña: una línea por cuenta. */
  porCuenta?: SerieSpendCuenta[];
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
  ): Promise<SeriesPublicitariasResult> {
    if (input.conjuntoAnuncioId || input.anuncioId) {
      return { porDia: [] };
    }

    const hoy = hoyLima();
    const fechaDesde = input.fechaDesde ?? inicioMesLima(hoy);
    const fechaHasta = input.fechaHasta ?? finMesLima(hoy);
    const filtroBase = {
      metaCuentaId: input.metaCuentaId,
      campanaId: input.campanaId,
      desde: new Date(`${fechaDesde}T00:00:00.000Z`),
      hasta: new Date(`${fechaHasta}T00:00:00.000Z`),
    };

    const desglosePorCuenta = !input.metaCuentaId && !input.campanaId;

    if (desglosePorCuenta) {
      const porCuenta = await this.insights.serieDiariaSpendPorCuenta(
        organizacionId,
        { desde: filtroBase.desde, hasta: filtroBase.hasta },
        fechaDesde,
        fechaHasta,
      );

      const porDia = sumarSeriesPorDia(porCuenta, fechaDesde, fechaHasta);
      return { porDia, porCuenta };
    }

    const porDia = await this.insights.serieDiariaSpend(
      organizacionId,
      filtroBase,
      fechaDesde,
      fechaHasta,
    );

    return { porDia };
  }
}

function sumarSeriesPorDia(
  series: SerieSpendCuenta[],
  fechaDesde: string,
  fechaHasta: string,
): PuntoSpendDia[] {
  const porDia = new Map<string, number>();
  for (const serie of series) {
    for (const punto of serie.porDia) {
      porDia.set(punto.fecha, (porDia.get(punto.fecha) ?? 0) + punto.spend);
    }
  }

  const puntos: PuntoSpendDia[] = [];
  let cursor = fechaDesde;
  while (cursor <= fechaHasta) {
    puntos.push({ fecha: cursor, spend: porDia.get(cursor) ?? 0 });
    const [year, month, day] = cursor.split('-').map(Number);
    const siguiente = new Date(Date.UTC(year, month - 1, day + 1));
    const y = siguiente.getUTCFullYear();
    const m = String(siguiente.getUTCMonth() + 1).padStart(2, '0');
    const d = String(siguiente.getUTCDate()).padStart(2, '0');
    cursor = `${y}-${m}-${d}`;
  }
  return puntos;
}
