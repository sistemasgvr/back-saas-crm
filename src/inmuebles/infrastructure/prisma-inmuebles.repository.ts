import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../shared/application/paginacion';
import type {
  ActualizarInmuebleInput,
  CrearInmuebleInput,
  FiltroInmuebles,
  InmuebleFiltroOption,
  InmuebleRow,
  InmueblesRepository,
  ListaInmueblesResultado,
} from '../application/ports/inmuebles.repository.port';

type InmuebleDb = {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  operacion: string;
  zona: string | null;
  direccion: string | null;
  precio: Prisma.Decimal | null;
  moneda: string;
  estadoInmueble: string;
  notas: string | null;
  fechaCreacion: Date;
  fechaModificacion: Date;
};

@Injectable()
export class PrismaInmueblesRepository implements InmueblesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    organizacionId: string,
    filtro: FiltroInmuebles,
  ): Promise<ListaInmueblesResultado> {
    const where: Prisma.InmuebleWhereInput = {
      organizacionId,
      estado: 1,
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.operacion ? { operacion: filtro.operacion } : {}),
      ...(filtro.estadoInmueble
        ? { estadoInmueble: filtro.estadoInmueble }
        : {}),
      ...(filtro.zona
        ? { zona: { contains: filtro.zona, mode: 'insensitive' } }
        : {}),
      ...(filtro.q
        ? {
            OR: [
              { codigo: { contains: filtro.q, mode: 'insensitive' } },
              { titulo: { contains: filtro.q, mode: 'insensitive' } },
              { zona: { contains: filtro.q, mode: 'insensitive' } },
              { direccion: { contains: filtro.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (filtro.page - 1) * filtro.pageSize;
    const [total, filas] = await this.prisma.$transaction([
      this.prisma.inmueble.count({ where }),
      this.prisma.inmueble.findMany({
        where,
        orderBy: [{ codigo: 'asc' }],
        skip,
        take: filtro.pageSize,
      }),
    ]);

    return construirResultadoPaginado(
      filas.map((f) => this.toRow(f)),
      total,
      filtro.page,
      filtro.pageSize,
    );
  }

  async listarFiltro(organizacionId: string): Promise<InmuebleFiltroOption[]> {
    const filas = await this.prisma.inmueble.findMany({
      where: {
        organizacionId,
        estado: 1,
        estadoInmueble: { in: ['DISPONIBLE', 'RESERVADO'] },
      },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        operacion: true,
        estadoInmueble: true,
        zona: true,
      },
      orderBy: [{ codigo: 'asc' }],
      take: 500,
    });
    return filas;
  }

  async obtenerPorId(
    organizacionId: string,
    id: string,
  ): Promise<InmuebleRow | null> {
    const f = await this.prisma.inmueble.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    return f ? this.toRow(f) : null;
  }

  async existeCodigo(
    organizacionId: string,
    codigo: string,
    excluirId?: string,
  ): Promise<boolean> {
    const encontrado = await this.prisma.inmueble.findFirst({
      where: {
        organizacionId,
        codigo,
        estado: 1,
        ...(excluirId ? { id: { not: excluirId } } : {}),
      },
      select: { id: true },
    });
    return Boolean(encontrado);
  }

  async crear(
    organizacionId: string,
    input: CrearInmuebleInput,
  ): Promise<InmuebleRow> {
    const creado = await this.prisma.inmueble.create({
      data: {
        organizacionId,
        codigo: input.codigo,
        titulo: input.titulo,
        tipo: input.tipo,
        operacion: input.operacion,
        zona: input.zona ?? null,
        direccion: input.direccion ?? null,
        precio:
          input.precio !== undefined && input.precio !== null
            ? new Prisma.Decimal(input.precio)
            : null,
        moneda: input.moneda ?? 'PEN',
        estadoInmueble: input.estadoInmueble ?? 'DISPONIBLE',
        notas: input.notas ?? null,
        usuarioCreacion: input.usuarioId,
        usuarioEdicion: input.usuarioId,
      },
    });
    return this.toRow(creado);
  }

  async actualizar(
    organizacionId: string,
    id: string,
    input: ActualizarInmuebleInput,
  ): Promise<InmuebleRow | null> {
    const existente = await this.prisma.inmueble.findFirst({
      where: { id, organizacionId, estado: 1 },
      select: { id: true },
    });
    if (!existente) return null;

    const actualizado = await this.prisma.inmueble.update({
      where: { id },
      data: {
        ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
        ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
        ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
        ...(input.operacion !== undefined
          ? { operacion: input.operacion }
          : {}),
        ...(input.zona !== undefined ? { zona: input.zona } : {}),
        ...(input.direccion !== undefined
          ? { direccion: input.direccion }
          : {}),
        ...(input.precio !== undefined
          ? {
              precio:
                input.precio === null
                  ? null
                  : new Prisma.Decimal(input.precio),
            }
          : {}),
        ...(input.moneda !== undefined ? { moneda: input.moneda } : {}),
        ...(input.estadoInmueble !== undefined
          ? { estadoInmueble: input.estadoInmueble }
          : {}),
        ...(input.notas !== undefined ? { notas: input.notas } : {}),
        usuarioEdicion: input.usuarioId,
      },
    });
    return this.toRow(actualizado);
  }

  async softDelete(
    organizacionId: string,
    id: string,
    usuarioId: string,
  ): Promise<boolean> {
    const result = await this.prisma.inmueble.updateMany({
      where: { id, organizacionId, estado: 1 },
      data: { estado: 0, usuarioEdicion: usuarioId },
    });
    return result.count > 0;
  }

  private toRow(f: InmuebleDb): InmuebleRow {
    return {
      id: f.id,
      codigo: f.codigo,
      titulo: f.titulo,
      tipo: f.tipo,
      operacion: f.operacion,
      zona: f.zona,
      direccion: f.direccion,
      precio: f.precio === null ? null : Number(f.precio),
      moneda: f.moneda,
      estadoInmueble: f.estadoInmueble,
      notas: f.notas,
      fechaCreacion: f.fechaCreacion,
      fechaModificacion: f.fechaModificacion,
    };
  }
}
