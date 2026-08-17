import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { fechaLima, siguienteDiaLima } from '../../shared/application/lima-time';
import type {
  DashboardRepository,
  FiltroDashboard,
  PuntoSerieDia,
  PuntoSerieNombrado,
  RangoFechas,
} from '../application/ports/dashboard.repository.port';

function whereFiltro(
  organizacionId: string,
  filtro: FiltroDashboard,
  rango?: RangoFechas,
): Prisma.LeadWhereInput {
  return {
    organizacionId,
    estado: 1,
    ...(filtro.campanaId ? { campanaId: filtro.campanaId } : {}),
    ...(filtro.conjuntoAnuncioId ? { conjuntoAnuncioId: filtro.conjuntoAnuncioId } : {}),
    ...(filtro.anuncioId ? { anuncioId: filtro.anuncioId } : {}),
    ...(rango ? { fechaLead: { gte: rango.desde, lte: rango.hasta } } : {}),
  };
}

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  contarLeads(organizacionId: string, filtro: FiltroDashboard, rango?: RangoFechas): Promise<number> {
    return this.prisma.lead.count({ where: whereFiltro(organizacionId, filtro, rango) });
  }

  async serieDiaria(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<PuntoSerieDia[]> {
    const leads = await this.prisma.lead.findMany({
      where: whereFiltro(organizacionId, filtro, rango),
      select: { fechaLead: true },
    });

    const conteo = new Map<string, number>();
    for (const lead of leads) {
      if (!lead.fechaLead) continue;
      const dia = fechaLima(lead.fechaLead);
      conteo.set(dia, (conteo.get(dia) ?? 0) + 1);
    }

    const dias: PuntoSerieDia[] = [];
    let cursor = fechaDesde;
    while (cursor <= fechaHasta) {
      dias.push({ fecha: cursor, total: conteo.get(cursor) ?? 0 });
      cursor = siguienteDiaLima(cursor);
    }
    return dias;
  }

  async serieCampanas(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
  ): Promise<PuntoSerieNombrado[]> {
    const grupos = await this.prisma.lead.groupBy({
      by: ['campanaId'],
      where: { ...whereFiltro(organizacionId, filtro, rango), campanaId: { not: null } },
      _count: { _all: true },
    });

    const ids = grupos.map((g) => g.campanaId).filter((id): id is string => id !== null);
    const campanas = await this.prisma.campana.findMany({ where: { id: { in: ids } } });
    const nombrePorId = new Map(campanas.map((c) => [c.id, c.nombre]));

    return grupos
      .filter((g) => g.campanaId !== null)
      .map((g) => ({
        id: g.campanaId as string,
        nombre: nombrePorId.get(g.campanaId as string) ?? '(desconocida)',
        total: g._count._all,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async serieAnuncios(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
  ): Promise<PuntoSerieNombrado[]> {
    const grupos = await this.prisma.lead.groupBy({
      by: ['anuncioId'],
      where: { ...whereFiltro(organizacionId, filtro, rango), anuncioId: { not: null } },
      _count: { _all: true },
    });

    const ids = grupos.map((g) => g.anuncioId).filter((id): id is string => id !== null);
    const anuncios = await this.prisma.anuncio.findMany({ where: { id: { in: ids } } });
    const nombrePorId = new Map(anuncios.map((a) => [a.id, a.nombre]));

    return grupos
      .filter((g) => g.anuncioId !== null)
      .map((g) => ({
        id: g.anuncioId as string,
        nombre: nombrePorId.get(g.anuncioId as string) ?? '(desconocido)',
        total: g._count._all,
      }))
      .sort((a, b) => b.total - a.total);
  }
}
