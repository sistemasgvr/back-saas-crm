import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../../shared/application/paginacion';
import type {
  CampanaResumen,
  MetaCuentaPublicitariaRow,
  MetaCuentasPublicitariasRepository,
  VincularCuentaInput,
} from '../application/ports/meta-cuentas-publicitarias.repository.port';

function toRow(cuenta: {
  id: string;
  organizacionId: string;
  metaConexionId: string;
  adAccountId: string;
  nombre: string;
  moneda: string | null;
  estadoCuenta: string | null;
  timezone: string | null;
  ultimoSyncEn: Date | null;
  fechaCreacion: Date;
}): MetaCuentaPublicitariaRow {
  return { ...cuenta };
}

@Injectable()
export class PrismaMetaCuentasPublicitariasRepository implements MetaCuentasPublicitariasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorOrganizacion(
    organizacionId: string,
    page: number,
    pageSize: number,
  ) {
    const where = { organizacionId, estado: 1 };
    const [total, filas] = await Promise.all([
      this.prisma.metaCuentaPublicitaria.count({ where }),
      this.prisma.metaCuentaPublicitaria.findMany({
        where,
        orderBy: { fechaCreacion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return construirResultadoPaginado(filas.map(toRow), total, page, pageSize);
  }

  contarActivasPorOrganizacion(organizacionId: string): Promise<number> {
    return this.prisma.metaCuentaPublicitaria.count({
      where: { organizacionId, estado: 1 },
    });
  }

  async listarActivasFiltro(organizacionId: string) {
    const cuentas = await this.prisma.metaCuentaPublicitaria.findMany({
      where: { organizacionId, estado: 1 },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return cuentas;
  }

  async listarAdAccountIdsVinculados(
    organizacionId: string,
  ): Promise<string[]> {
    const filas = await this.prisma.metaCuentaPublicitaria.findMany({
      where: { organizacionId, estado: 1 },
      select: { adAccountId: true },
    });
    return filas.map((f) => f.adAccountId);
  }

  async findPorId(
    organizacionId: string,
    id: string,
  ): Promise<MetaCuentaPublicitariaRow | null> {
    const cuenta = await this.prisma.metaCuentaPublicitaria.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    return cuenta ? toRow(cuenta) : null;
  }

  async vincular(
    input: VincularCuentaInput,
  ): Promise<MetaCuentaPublicitariaRow> {
    const existente = await this.prisma.metaCuentaPublicitaria.findFirst({
      where: {
        organizacionId: input.organizacionId,
        adAccountId: input.adAccountId,
      },
    });

    const data = {
      metaConexionId: input.metaConexionId,
      nombre: input.nombre,
      moneda: input.moneda,
      estadoCuenta: input.estadoCuenta,
      timezone: input.timezone,
      estado: 1,
      usuarioEdicion: input.usuarioEdicion,
    };

    const cuenta = existente
      ? await this.prisma.metaCuentaPublicitaria.update({
          where: { id: existente.id },
          data,
        })
      : await this.prisma.metaCuentaPublicitaria.create({
          data: {
            organizacionId: input.organizacionId,
            adAccountId: input.adAccountId,
            usuarioCreacion: input.usuarioEdicion,
            ...data,
          },
        });

    return toRow(cuenta);
  }

  async actualizarUltimoSync(
    id: string,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.metaCuentaPublicitaria.update({
      where: { id },
      data: { ultimoSyncEn: new Date(), usuarioEdicion },
    });
  }

  async desvincular(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<MetaCuentaPublicitariaRow | null> {
    const cuenta = await this.prisma.metaCuentaPublicitaria.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    if (!cuenta) return null;
    const actualizada = await this.prisma.metaCuentaPublicitaria.update({
      where: { id },
      data: { estado: 0, usuarioEdicion },
    });
    return toRow(actualizada);
  }

  async desvincularTodasDeOrganizacion(
    organizacionId: string,
    usuarioEdicion: string,
  ): Promise<MetaCuentaPublicitariaRow[]> {
    const activas = await this.prisma.metaCuentaPublicitaria.findMany({
      where: { organizacionId, estado: 1 },
    });
    if (activas.length === 0) return [];
    await this.prisma.metaCuentaPublicitaria.updateMany({
      where: { organizacionId, estado: 1 },
      data: { estado: 0, usuarioEdicion },
    });
    return activas.map(toRow);
  }

  contarCampanas(metaCuentaPublicitariaId: string): Promise<number> {
    return this.prisma.campana.count({
      where: { metaCuentaPublicitariaId, estado: 1 },
    });
  }

  contarLeads(metaCuentaPublicitariaId: string): Promise<number> {
    return this.prisma.lead.count({
      where: { campana: { metaCuentaPublicitariaId }, estado: 1 },
    });
  }

  async listarUltimasCampanas(
    metaCuentaPublicitariaId: string,
    limite: number,
  ): Promise<CampanaResumen[]> {
    const campanas = await this.prisma.campana.findMany({
      where: { metaCuentaPublicitariaId, estado: 1 },
      orderBy: { fechaCreacion: 'desc' },
      take: limite,
      include: { _count: { select: { leads: true } } },
    });
    return campanas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      estadoMeta: c.estadoMeta,
      totalLeads: c._count.leads,
    }));
  }
}
