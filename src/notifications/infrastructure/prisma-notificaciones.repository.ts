import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../shared/application/paginacion';
import type {
  CrearNotificacionInput,
  NotificacionListItem,
  NotificacionesRepository,
} from '../application/ports/notificaciones.repository.port';

// Se agrupa antes de paginar: también incluye los avisos históricos y evita
// repetir un chat entre páginas. Los demás tipos conservan su propia fila.
const claveGrupo = Prisma.sql`CASE
  WHEN n.tipo = 'WHATSAPP_MENSAJE'
    AND jsonb_typeof(n.payload->'whatsappConversacionId') = 'string'
    AND n.payload->>'whatsappConversacionId' <> ''
  THEN 'whatsapp:' || (n.payload->>'whatsappConversacionId')
  ELSE nu.id::text
END`;

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
    const [conteo, data] = await Promise.all([
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(DISTINCT ${claveGrupo})::int AS total
        FROM notificaciones_usuario nu
        JOIN notificaciones n ON n.id = nu.notificacion_id
        WHERE nu.organizacion_id = ${organizacionId}::uuid
          AND nu.usuario_id = ${usuarioId}::uuid AND nu.estado = 1
      `),
      this.prisma.$queryRaw<NotificacionListItem[]>(Prisma.sql`
        WITH agrupadas AS (
          SELECT nu.id, n.tipo, n.titulo, n.mensaje, n.payload,
            nu.fecha_creacion AS "fechaCreacion",
            CASE WHEN MIN(nu.leida) OVER grupo = 1
              THEN nu.fecha_lectura ELSE NULL END AS "fechaLectura",
            MIN(nu.leida) OVER grupo = 1 AS leida,
            (COUNT(*) FILTER (WHERE nu.leida = 0) OVER grupo)::int AS "cantidadNoLeidas",
            ROW_NUMBER() OVER (
              PARTITION BY ${claveGrupo}
              ORDER BY nu.fecha_creacion DESC, nu.id DESC
            ) AS posicion
          FROM notificaciones_usuario nu
          JOIN notificaciones n ON n.id = nu.notificacion_id
          WHERE nu.organizacion_id = ${organizacionId}::uuid
            AND nu.usuario_id = ${usuarioId}::uuid AND nu.estado = 1
          WINDOW grupo AS (PARTITION BY ${claveGrupo})
        )
        SELECT id, tipo, titulo, mensaje, payload, leida,
          "fechaCreacion", "fechaLectura", "cantidadNoLeidas"
        FROM agrupadas WHERE posicion = 1
        ORDER BY "fechaCreacion" DESC, id DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `),
    ]);

    return construirResultadoPaginado(
      data,
      conteo[0]?.total ?? 0,
      page,
      pageSize,
    );
  }

  async contarNoLeidas(organizacionId: string, usuarioId: string) {
    const filas = await this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT ${claveGrupo})::int AS total
      FROM notificaciones_usuario nu
      JOIN notificaciones n ON n.id = nu.notificacion_id
      WHERE nu.organizacion_id = ${organizacionId}::uuid
        AND nu.usuario_id = ${usuarioId}::uuid
        AND nu.estado = 1 AND nu.leida = 0
    `);
    return filas[0]?.total ?? 0;
  }

  async marcarLeida(
    organizacionId: string,
    usuarioId: string,
    notificacionUsuarioId: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const fila = await tx.notificacionUsuario.findFirst({
        where: {
          id: notificacionUsuarioId,
          organizacionId,
          usuarioId,
          estado: 1,
        },
        include: { notificacion: true },
      });
      if (!fila) return false;
      const payload = fila.notificacion.payload as Record<
        string,
        unknown
      > | null;
      const conversacionId = payload?.whatsappConversacionId;
      const agrupar =
        fila.notificacion.tipo === 'WHATSAPP_MENSAJE' &&
        typeof conversacionId === 'string' &&
        conversacionId.length > 0;

      await tx.notificacionUsuario.updateMany({
        where: {
          organizacionId,
          usuarioId,
          estado: 1,
          ...(agrupar
            ? {
                // No consumir un mensaje nuevo recibido después del aviso abierto.
                fechaCreacion: { lte: fila.fechaCreacion },
                notificacion: {
                  tipo: 'WHATSAPP_MENSAJE',
                  payload: {
                    path: ['whatsappConversacionId'],
                    equals: conversacionId,
                  },
                },
              }
            : { id: fila.id }),
        },
        data: { leida: 1, fechaLectura: new Date() },
      });
      return true;
    });
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

  async marcarLeidasPorWhatsappConversacion(
    organizacionId: string,
    usuarioId: string,
    conversacionId: string,
  ): Promise<number> {
    const resultado = await this.prisma.notificacionUsuario.updateMany({
      where: {
        organizacionId,
        usuarioId,
        leida: 0,
        estado: 1,
        notificacion: {
          tipo: 'WHATSAPP_MENSAJE',
          payload: {
            path: ['whatsappConversacionId'],
            equals: conversacionId,
          },
        },
      },
      data: { leida: 1, fechaLectura: new Date() },
    });
    return resultado.count;
  }

  async findUsuarioIdsActivosDeOrganizacion(
    organizacionId: string,
    roles?: string[],
  ): Promise<string[]> {
    const filas = await this.prisma.organizacionUsuario.findMany({
      where: {
        organizacionId,
        estado: 1,
        usuario: { estado: 1 },
        ...(roles?.length ? { rol: { in: roles } } : {}),
      },
      select: { usuarioId: true },
    });
    return filas.map((fila) => fila.usuarioId);
  }
}
