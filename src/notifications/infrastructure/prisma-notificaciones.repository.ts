import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../shared/application/paginacion';
import type {
  CrearNotificacionInput,
  NotificacionesRepository,
} from '../application/ports/notificaciones.repository.port';

@Injectable()
export class PrismaNotificacionesRepository implements NotificacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crearConFanOut(input: CrearNotificacionInput) {
    const notificacion = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.notificacion.create({
        data: {
          organizacionId: input.organizacionId,
          tipo: input.tipo,
          titulo: input.titulo,
          mensaje: input.mensaje,
          payload: input.payload as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.notificacionUsuario.createMany({
        data: input.usuarioIds.map((usuarioId) => ({
          notificacionId: creada.id,
          organizacionId: input.organizacionId,
          usuarioId,
        })),
      });

      return creada;
    });

    return {
      id: notificacion.id,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      payload: notificacion.payload,
      fechaCreacion: notificacion.fechaCreacion,
      usuarioIds: input.usuarioIds,
    };
  }

  async listarPorUsuario(
    organizacionId: string,
    usuarioId: string,
    page: number,
    pageSize: number,
  ) {
    const where = { organizacionId, usuarioId, estado: 1 };

    const [total, filas] = await Promise.all([
      this.prisma.notificacionUsuario.count({ where }),
      this.prisma.notificacionUsuario.findMany({
        where,
        include: { notificacion: true },
        orderBy: { fechaCreacion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data = filas.map((fila) => ({
      id: fila.id,
      tipo: fila.notificacion.tipo,
      titulo: fila.notificacion.titulo,
      mensaje: fila.notificacion.mensaje,
      payload: fila.notificacion.payload,
      leida: fila.leida === 1,
      fechaCreacion: fila.fechaCreacion,
      fechaLectura: fila.fechaLectura,
    }));

    return construirResultadoPaginado(data, total, page, pageSize);
  }

  contarNoLeidas(organizacionId: string, usuarioId: string) {
    return this.prisma.notificacionUsuario.count({
      where: { organizacionId, usuarioId, estado: 1, leida: 0 },
    });
  }

  async marcarLeida(
    organizacionId: string,
    usuarioId: string,
    notificacionUsuarioId: string,
  ): Promise<boolean> {
    const resultado = await this.prisma.notificacionUsuario.updateMany({
      where: { id: notificacionUsuarioId, organizacionId, usuarioId },
      data: { leida: 1, fechaLectura: new Date() },
    });
    return resultado.count > 0;
  }

  async marcarTodasLeidas(
    organizacionId: string,
    usuarioId: string,
  ): Promise<number> {
    const resultado = await this.prisma.notificacionUsuario.updateMany({
      where: { organizacionId, usuarioId, leida: 0 },
      data: { leida: 1, fechaLectura: new Date() },
    });
    return resultado.count;
  }

  async findUsuarioIdsActivosDeOrganizacion(
    organizacionId: string,
  ): Promise<string[]> {
    const filas = await this.prisma.organizacionUsuario.findMany({
      where: { organizacionId, estado: 1 },
      select: { usuarioId: true },
    });
    return filas.map((fila) => fila.usuarioId);
  }
}
