import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import {
  fechaLima,
  siguienteDiaLima,
} from '../../shared/application/lima-time';
import type {
  ConteoEstadoGestion,
  DashboardRepository,
  EmbudoKpisPorTipo,
  EmbudoKpisRaw,
  FiltroAsignacionDashboard,
  FiltroDashboard,
  PuntoSerieDia,
  PuntoSerieNombrado,
  RangoFechas,
  TiempoPromedioEstado,
} from '../application/ports/dashboard.repository.port';

/** Estados que implican que el lead ya fue contactado (≥ CONTACTADO). */
const ESTADOS_CONTACTADO_O_MAS = [
  'CONTACTADO',
  'CALIFICADO',
  'VISITA_AGENDADA',
  'VISITA_REALIZADA',
  'CAPTACION',
  'EN_COMERCIALIZACION',
  'NEGOCIACION',
  'SEPARACION',
  'CERRADO_GANADO',
  'CERRADO_PERDIDO',
] as const;

function whereAsignacion(
  asignacion?: FiltroAsignacionDashboard,
): Prisma.LeadWhereInput {
  if (!asignacion || asignacion.modo === 'todos') return {};
  if (asignacion.modo === 'sin_asignar') return { asignadoUsuarioId: null };
  if (asignacion.modo === 'usuario') {
    return { asignadoUsuarioId: asignacion.usuarioId };
  }
  return {
    OR: [
      { asignadoUsuarioId: asignacion.usuarioId },
      { asignadoUsuarioId: null },
    ],
  };
}

function whereFiltro(
  organizacionId: string,
  filtro: FiltroDashboard,
  rango?: RangoFechas,
): Prisma.LeadWhereInput {
  return {
    organizacionId,
    estado: 1,
    ...(filtro.campanaId ? { campanaId: filtro.campanaId } : {}),
    ...(filtro.conjuntoAnuncioId
      ? { conjuntoAnuncioId: filtro.conjuntoAnuncioId }
      : {}),
    ...(filtro.anuncioId ? { anuncioId: filtro.anuncioId } : {}),
    ...(filtro.metaCuentaId
      ? { campana: { metaCuentaPublicitariaId: filtro.metaCuentaId } }
      : {}),
    ...(filtro.tipoLead ? { tipoLead: filtro.tipoLead } : {}),
    ...whereAsignacion(filtro.asignacion),
    ...(rango ? { fechaLead: { gte: rango.desde, lte: rango.hasta } } : {}),
  };
}

function msAHoras(ms: number): number {
  return Math.round((ms / 3_600_000) * 10) / 10;
}

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  contarLeads(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango?: RangoFechas,
  ): Promise<number> {
    return this.prisma.lead.count({
      where: whereFiltro(organizacionId, filtro, rango),
    });
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
      where: {
        ...whereFiltro(organizacionId, filtro, rango),
        campanaId: { not: null },
      },
      _count: { _all: true },
    });

    const ids = grupos
      .map((g) => g.campanaId)
      .filter((id): id is string => id !== null);
    const campanas = await this.prisma.campana.findMany({
      where: { id: { in: ids }, estado: 1 },
    });
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
      where: {
        ...whereFiltro(organizacionId, filtro, rango),
        anuncioId: { not: null },
      },
      _count: { _all: true },
    });

    const ids = grupos
      .map((g) => g.anuncioId)
      .filter((id): id is string => id !== null);
    const anuncios = await this.prisma.anuncio.findMany({
      where: { id: { in: ids }, estado: 1 },
    });
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

  async embudoKpis(
    organizacionId: string,
    filtro: FiltroDashboard,
    rango: RangoFechas,
  ): Promise<EmbudoKpisRaw> {
    const where = whereFiltro(organizacionId, filtro, rango);
    const ahora = new Date();

    const [total, porEstadoRaw, contactados, cerradosGanados, leads] =
      await Promise.all([
        this.prisma.lead.count({ where }),
        this.prisma.lead.groupBy({
          by: ['estadoGestion'],
          where,
          _count: { _all: true },
        }),
        this.prisma.lead.count({
          where: {
            AND: [
              where,
              {
                OR: [
                  {
                    estadoGestion: {
                      in: [...ESTADOS_CONTACTADO_O_MAS],
                    },
                  },
                  {
                    estadoHistorial: {
                      some: {
                        hacia: { in: [...ESTADOS_CONTACTADO_O_MAS] },
                      },
                    },
                  },
                ],
              },
            ],
          },
        }),
        this.prisma.lead.count({
          where: { ...where, estadoGestion: 'CERRADO_GANADO' },
        }),
        this.prisma.lead.findMany({
          where,
          select: {
            tipoLead: true,
            estadoGestion: true,
            estadoGestionEn: true,
            fechaCreacion: true,
            estadoHistorial: {
              orderBy: { fechaCreacion: 'asc' },
              select: { hacia: true, fechaCreacion: true },
            },
          },
        }),
      ]);

    const porEstado: ConteoEstadoGestion[] = porEstadoRaw.map((g) => ({
      estadoGestion: g.estadoGestion,
      total: g._count._all,
    }));

    const sumasTiempo = new Map<string, { sumaMs: number; muestras: number }>();
    const porTipoMap = new Map<
      string | null,
      {
        total: number;
        contactados: number;
        cerradosGanados: number;
        porEstado: Map<string, number>;
      }
    >();

    for (const lead of leads) {
      const tipoKey = lead.tipoLead;
      let bucket = porTipoMap.get(tipoKey);
      if (!bucket) {
        bucket = {
          total: 0,
          contactados: 0,
          cerradosGanados: 0,
          porEstado: new Map(),
        };
        porTipoMap.set(tipoKey, bucket);
      }
      bucket.total += 1;
      bucket.porEstado.set(
        lead.estadoGestion,
        (bucket.porEstado.get(lead.estadoGestion) ?? 0) + 1,
      );
      if (lead.estadoGestion === 'CERRADO_GANADO') {
        bucket.cerradosGanados += 1;
      }
      const contactado =
        (ESTADOS_CONTACTADO_O_MAS as readonly string[]).includes(
          lead.estadoGestion,
        ) ||
        lead.estadoHistorial.some((h) =>
          (ESTADOS_CONTACTADO_O_MAS as readonly string[]).includes(h.hacia),
        );
      if (contactado) bucket.contactados += 1;

      const historial = lead.estadoHistorial;
      if (historial.length === 0) {
        const inicio = lead.estadoGestionEn ?? lead.fechaCreacion;
        const ms = ahora.getTime() - inicio.getTime();
        if (ms >= 0) {
          const prev = sumasTiempo.get(lead.estadoGestion) ?? {
            sumaMs: 0,
            muestras: 0,
          };
          prev.sumaMs += ms;
          prev.muestras += 1;
          sumasTiempo.set(lead.estadoGestion, prev);
        }
        continue;
      }

      for (let i = 0; i < historial.length; i++) {
        const entrada = historial[i];
        const fin =
          i + 1 < historial.length
            ? historial[i + 1].fechaCreacion
            : entrada.hacia === lead.estadoGestion
              ? ahora
              : null;
        if (!fin) continue;
        const ms = fin.getTime() - entrada.fechaCreacion.getTime();
        if (ms < 0) continue;
        const prev = sumasTiempo.get(entrada.hacia) ?? {
          sumaMs: 0,
          muestras: 0,
        };
        prev.sumaMs += ms;
        prev.muestras += 1;
        sumasTiempo.set(entrada.hacia, prev);
      }
    }

    const tiempoPromedioPorEstado: TiempoPromedioEstado[] = [
      ...sumasTiempo.entries(),
    ].map(([estadoGestion, { sumaMs, muestras }]) => ({
      estadoGestion,
      horasPromedio: muestras > 0 ? msAHoras(sumaMs / muestras) : null,
      muestras,
    }));

    const porTipoLead: EmbudoKpisPorTipo[] = [...porTipoMap.entries()]
      .map(([tipoLead, b]) => ({
        tipoLead,
        total: b.total,
        contactados: b.contactados,
        cerradosGanados: b.cerradosGanados,
        porEstado: [...b.porEstado.entries()].map(([estadoGestion, t]) => ({
          estadoGestion,
          total: t,
        })),
      }))
      .sort((a, b) => {
        const orden = ['COMPRA', 'VENTA', 'OTRO'];
        const ia = a.tipoLead ? orden.indexOf(a.tipoLead) : 99;
        const ib = b.tipoLead ? orden.indexOf(b.tipoLead) : 99;
        return ia - ib;
      });

    return {
      total,
      contactados,
      cerradosGanados,
      porEstado,
      tiempoPromedioPorEstado,
      porTipoLead,
    };
  }
}
