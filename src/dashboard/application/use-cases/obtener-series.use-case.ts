import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '../ports/dashboard.repository.port';
import type {
  DashboardRepository,
  FiltroDashboard,
} from '../ports/dashboard.repository.port';
import {
  finDiaLimaUtc,
  finMesLima,
  hoyLima,
  inicioDiaLimaUtc,
  inicioMesLima,
} from '../../../shared/application/lima-time';

export interface ObtenerSeriesInput extends FiltroDashboard {
  fechaDesde?: string;
  fechaHasta?: string;
}

@Injectable()
export class ObtenerSeriesUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboard: DashboardRepository,
  ) {}

  async execute(organizacionId: string, input: ObtenerSeriesInput) {
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

    const [porDia, porCampana, porAnuncio, porInmueble] = await Promise.all([
      this.dashboard.serieDiaria(
        organizacionId,
        filtro,
        rango,
        fechaDesde,
        fechaHasta,
      ),
      this.dashboard.serieCampanas(organizacionId, filtro, rango),
      this.dashboard.serieAnuncios(organizacionId, filtro, rango),
      this.dashboard.serieInmuebles(organizacionId, filtro, rango, 10),
    ]);

    return { porDia, porCampana, porAnuncio, porInmueble };
  }
}
