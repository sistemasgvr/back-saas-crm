import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../../shared/application/paginacion';
import type {
  MetaPaginaConConexion,
  MetaPaginaDesvinculada,
  MetaPaginaRow,
  MetaPaginasRepository,
  VincularPaginaInput,
} from '../application/ports/meta-paginas.repository.port';

function toRow(pagina: {
  id: string;
  organizacionId: string;
  metaConexionId: string;
  pageId: string;
  nombre: string;
  webhookSuscrito: number;
  webhookSuscritoEn: Date | null;
  webhookUltimoCheckEn: Date | null;
  webhookUltimoError: string | null;
  fotoUrl: string | null;
  categoria: string | null;
  fechaCreacion: Date;
}): MetaPaginaRow {
  return {
    id: pagina.id,
    organizacionId: pagina.organizacionId,
    metaConexionId: pagina.metaConexionId,
    pageId: pagina.pageId,
    nombre: pagina.nombre,
    webhookSuscrito: pagina.webhookSuscrito === 1,
    webhookSuscritoEn: pagina.webhookSuscritoEn,
    webhookUltimoCheckEn: pagina.webhookUltimoCheckEn,
    webhookUltimoError: pagina.webhookUltimoError,
    fotoUrl: pagina.fotoUrl,
    categoria: pagina.categoria,
    fechaCreacion: pagina.fechaCreacion,
  };
}

@Injectable()
export class PrismaMetaPaginasRepository implements MetaPaginasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorOrganizacion(
    organizacionId: string,
    page: number,
    pageSize: number,
  ) {
    const where = { organizacionId, estado: 1 };
    const [total, filas] = await Promise.all([
      this.prisma.metaPagina.count({ where }),
      this.prisma.metaPagina.findMany({
        where,
        orderBy: { fechaCreacion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return construirResultadoPaginado(filas.map(toRow), total, page, pageSize);
  }

  async listarActivasFiltro(organizacionId: string) {
    const paginas = await this.prisma.metaPagina.findMany({
      where: { organizacionId, estado: 1 },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return paginas;
  }

  contarActivasPorOrganizacion(organizacionId: string): Promise<number> {
    return this.prisma.metaPagina.count({
      where: { organizacionId, estado: 1 },
    });
  }

  async listarPageIdsVinculados(organizacionId: string): Promise<string[]> {
    const filas = await this.prisma.metaPagina.findMany({
      where: { organizacionId, estado: 1 },
      select: { pageId: true },
    });
    return filas.map((f) => f.pageId);
  }

  async findPorId(
    organizacionId: string,
    id: string,
  ): Promise<MetaPaginaRow | null> {
    const pagina = await this.prisma.metaPagina.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    return pagina ? toRow(pagina) : null;
  }

  async findActivaPorPageId(
    pageId: string,
  ): Promise<MetaPaginaConConexion | null> {
    const pagina = await this.prisma.metaPagina.findFirst({
      where: { pageId, estado: 1 },
      include: {
        metaConexion: {
          select: { tokenCifrado: true, appSecretCifrado: true },
        },
      },
    });
    if (!pagina) return null;
    return {
      id: pagina.id,
      organizacionId: pagina.organizacionId,
      metaConexionId: pagina.metaConexionId,
      pageId: pagina.pageId,
      nombre: pagina.nombre,
      tokenPaginaCifrado: pagina.tokenPaginaCifrado,
      conexionTokenCifrado: pagina.metaConexion.tokenCifrado,
      conexionAppSecretCifrado: pagina.metaConexion.appSecretCifrado,
    };
  }

  async vincular(input: VincularPaginaInput): Promise<MetaPaginaRow> {
    const existente = await this.prisma.metaPagina.findFirst({
      where: { organizacionId: input.organizacionId, pageId: input.pageId },
    });

    const data = {
      metaConexionId: input.metaConexionId,
      nombre: input.nombre,
      tokenPaginaCifrado: input.tokenPaginaCifrado,
      webhookSuscrito: input.webhookSuscrito ? 1 : 0,
      webhookSuscritoEn: input.webhookSuscrito ? new Date() : null,
      estado: 1,
      usuarioEdicion: input.usuarioEdicion,
    };

    const pagina = existente
      ? await this.prisma.metaPagina.update({
          where: { id: existente.id },
          data,
        })
      : await this.prisma.metaPagina.create({
          data: {
            organizacionId: input.organizacionId,
            pageId: input.pageId,
            usuarioCreacion: input.usuarioEdicion,
            ...data,
          },
        });

    return toRow(pagina);
  }

  async actualizarWebhookSuscrito(
    id: string,
    suscrito: boolean,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.metaPagina.update({
      where: { id },
      data: {
        webhookSuscrito: suscrito ? 1 : 0,
        webhookSuscritoEn: suscrito ? new Date() : null,
        usuarioEdicion,
      },
    });
  }

  async actualizarSaludWebhook(
    id: string,
    suscrito: boolean,
    error: string | null,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.metaPagina.update({
      where: { id },
      data: {
        webhookSuscrito: suscrito ? 1 : 0,
        webhookUltimoCheckEn: new Date(),
        webhookUltimoError: error,
        usuarioEdicion,
      },
    });
  }

  async desvincular(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<MetaPaginaRow | null> {
    const pagina = await this.prisma.metaPagina.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    if (!pagina) return null;
    const actualizada = await this.prisma.metaPagina.update({
      where: { id },
      data: { estado: 0, usuarioEdicion },
    });
    return toRow(actualizada);
  }

  async desvincularTodasDeOrganizacion(
    organizacionId: string,
    usuarioEdicion: string,
  ): Promise<MetaPaginaDesvinculada[]> {
    const activas = await this.prisma.metaPagina.findMany({
      where: { organizacionId, estado: 1 },
    });
    if (activas.length === 0) return [];
    await this.prisma.metaPagina.updateMany({
      where: { organizacionId, estado: 1 },
      data: { estado: 0, usuarioEdicion },
    });
    return activas.map((pagina) => ({
      ...toRow(pagina),
      tokenPaginaCifrado: pagina.tokenPaginaCifrado,
    }));
  }

  contarLeadsTotal(metaPaginaId: string): Promise<number> {
    return this.prisma.lead.count({ where: { metaPaginaId, estado: 1 } });
  }

  contarLeadsDesde(metaPaginaId: string, desde: Date): Promise<number> {
    return this.prisma.lead.count({
      where: { metaPaginaId, estado: 1, fechaLead: { gte: desde } },
    });
  }
}
