import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  FiltroInsightsDiarios,
  MetaInsightsRepository,
  PuntoSpendDia,
  ResumenSpend,
  UpsertInsightDiarioInput,
} from '../application/ports/meta-insights.repository.port';

/** meta_insights_diarios.fecha es @db.Date (sin timezone) — se formatea con
 * getters UTC directos, no vía Lima, para no reinterpretar el día ya alineado. */
function formatFechaSolaDia(fecha: Date): string {
  const year = fecha.getUTCFullYear();
  const month = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const day = String(fecha.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function whereFiltro(
  organizacionId: string,
  filtro: FiltroInsightsDiarios,
): Prisma.MetaInsightDiarioWhereInput {
  return {
    organizacionId,
    estado: 1,
    ...(filtro.metaCuentaId
      ? { metaCuentaPublicitariaId: filtro.metaCuentaId }
      : {}),
    campanaId: filtro.campanaId ?? null,
    ...(filtro.desde || filtro.hasta
      ? {
          fecha: {
            ...(filtro.desde ? { gte: filtro.desde } : {}),
            ...(filtro.hasta ? { lte: filtro.hasta } : {}),
          },
        }
      : {}),
  };
}

@Injectable()
export class PrismaMetaInsightsRepository implements MetaInsightsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertDiario(input: UpsertInsightDiarioInput): Promise<void> {
    const existente = await this.prisma.metaInsightDiario.findFirst({
      where: {
        organizacionId: input.organizacionId,
        metaCuentaPublicitariaId: input.metaCuentaPublicitariaId,
        campanaId: input.campanaId ?? null,
        fecha: input.fecha,
      },
    });

    const datos = {
      spend: input.spend,
      impressions: BigInt(Math.round(input.impressions)),
      clicks: BigInt(Math.round(input.clicks)),
      ctr: input.ctr ?? null,
      cpc: input.cpc ?? null,
      reach: input.reach !== undefined ? BigInt(Math.round(input.reach)) : null,
      moneda: input.moneda ?? null,
      datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
      estado: 1,
      usuarioEdicion: input.usuarioEdicion,
    };

    if (existente) {
      await this.prisma.metaInsightDiario.update({
        where: { id: existente.id },
        data: datos,
      });
      return;
    }

    await this.prisma.metaInsightDiario.create({
      data: {
        organizacionId: input.organizacionId,
        metaCuentaPublicitariaId: input.metaCuentaPublicitariaId,
        campanaId: input.campanaId ?? null,
        fecha: input.fecha,
        usuarioCreacion: input.usuarioEdicion,
        ...datos,
      },
    });
  }

  async sumarSpend(
    organizacionId: string,
    filtro: FiltroInsightsDiarios,
  ): Promise<ResumenSpend> {
    const where = whereFiltro(organizacionId, filtro);
    const [agregado, unaFila] = await Promise.all([
      this.prisma.metaInsightDiario.aggregate({
        where,
        _sum: { spend: true, impressions: true, clicks: true },
      }),
      this.prisma.metaInsightDiario.findFirst({
        where,
        select: { moneda: true },
      }),
    ]);

    return {
      spend: Number(agregado._sum.spend ?? 0),
      impressions: Number(agregado._sum.impressions ?? 0),
      clicks: Number(agregado._sum.clicks ?? 0),
      moneda: unaFila?.moneda ?? null,
    };
  }

  async serieDiariaSpend(
    organizacionId: string,
    filtro: FiltroInsightsDiarios,
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<PuntoSpendDia[]> {
    const filas = await this.prisma.metaInsightDiario.findMany({
      where: whereFiltro(organizacionId, filtro),
      select: { fecha: true, spend: true },
    });

    const porDia = new Map<string, number>();
    for (const fila of filas) {
      const clave = formatFechaSolaDia(fila.fecha);
      porDia.set(clave, (porDia.get(clave) ?? 0) + Number(fila.spend));
    }

    const puntos: PuntoSpendDia[] = [];
    let cursor = fechaDesde;
    while (cursor <= fechaHasta) {
      puntos.push({ fecha: cursor, spend: porDia.get(cursor) ?? 0 });
      const [year, month, day] = cursor.split('-').map(Number);
      const siguiente = new Date(Date.UTC(year, month - 1, day + 1));
      cursor = formatFechaSolaDia(siguiente);
    }
    return puntos;
  }
}
