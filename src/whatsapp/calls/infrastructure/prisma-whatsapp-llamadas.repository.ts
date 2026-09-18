import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import {
  ESTADOS_LLAMADA,
  ESTADOS_RECLAMABLES,
  RESULTADOS_LLAMADA,
} from '../domain/estados-llamada';
import type {
  ActualizarLlamadaCampos,
  FiltroListarLlamadas,
  MetricasLlamadas,
  UpsertLlamadaInput,
  WhatsappLlamadaRow,
  WhatsappLlamadasRepository,
} from '../application/ports/whatsapp-llamadas.repository.port';

function toRow(row: {
  id: string;
  organizacionId: string;
  whatsappConexionId: string;
  conversacionId: string | null;
  leadId: string | null;
  asignadoUsuarioId: string | null;
  callId: string;
  waId: string | null;
  direccion: string;
  estado: string;
  resultado: string | null;
  inicioEn: Date;
  contestadaEn: Date | null;
  finEn: Date | null;
  duracionSeg: number | null;
  notaPostLlamada: string | null;
  motivo: string | null;
  errorCodigo: string | null;
  errorMensaje: string | null;
  fechaCreacion: Date;
}): WhatsappLlamadaRow {
  return { ...row };
}

@Injectable()
export class PrismaWhatsappLlamadasRepository
  implements WhatsappLlamadasRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async upsertPorCallId(input: UpsertLlamadaInput): Promise<WhatsappLlamadaRow> {
    const existente = await this.prisma.whatsappLlamada.findUnique({
      where: {
        organizacionId_callId: {
          organizacionId: input.organizacionId,
          callId: input.callId,
        },
      },
    });

    if (existente) {
      const actualizada = await this.prisma.whatsappLlamada.update({
        where: { id: existente.id },
        data: {
          estado: input.estado,
          ...(input.resultado !== undefined
            ? { resultado: input.resultado }
            : {}),
          ...(input.waId !== undefined ? { waId: input.waId } : {}),
          ...(input.conversacionId !== undefined
            ? { conversacionId: input.conversacionId }
            : {}),
          ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
          ...(input.contestadaEn !== undefined
            ? { contestadaEn: input.contestadaEn }
            : {}),
          ...(input.finEn !== undefined ? { finEn: input.finEn } : {}),
          ...(input.duracionSeg !== undefined
            ? { duracionSeg: input.duracionSeg }
            : {}),
          ...(input.errorCodigo !== undefined
            ? { errorCodigo: input.errorCodigo }
            : {}),
          ...(input.errorMensaje !== undefined
            ? { errorMensaje: input.errorMensaje }
            : {}),
          ...(input.datosCrudos !== undefined
            ? { datosCrudos: input.datosCrudos as Prisma.InputJsonValue }
            : {}),
          ...(input.asignadoUsuarioId !== undefined
            ? { asignadoUsuarioId: input.asignadoUsuarioId }
            : {}),
        },
      });
      return toRow(actualizada);
    }

    const creada = await this.prisma.whatsappLlamada.create({
      data: {
        organizacionId: input.organizacionId,
        whatsappConexionId: input.whatsappConexionId,
        callId: input.callId,
        waId: input.waId ?? null,
        conversacionId: input.conversacionId ?? null,
        leadId: input.leadId ?? null,
        asignadoUsuarioId: input.asignadoUsuarioId ?? null,
        direccion: input.direccion,
        estado: input.estado,
        resultado: input.resultado ?? null,
        inicioEn: input.inicioEn,
        contestadaEn: input.contestadaEn ?? null,
        finEn: input.finEn ?? null,
        duracionSeg: input.duracionSeg ?? null,
        errorCodigo: input.errorCodigo ?? null,
        errorMensaje: input.errorMensaje ?? null,
        datosCrudos:
          input.datosCrudos !== undefined
            ? (input.datosCrudos as Prisma.InputJsonValue)
            : undefined,
      },
    });
    return toRow(creada);
  }

  async findPorId(
    organizacionId: string,
    id: string,
  ): Promise<WhatsappLlamadaRow | null> {
    const fila = await this.prisma.whatsappLlamada.findFirst({
      where: { id, organizacionId },
    });
    return fila ? toRow(fila) : null;
  }

  async findPorCallId(
    organizacionId: string,
    callId: string,
  ): Promise<WhatsappLlamadaRow | null> {
    const fila = await this.prisma.whatsappLlamada.findUnique({
      where: {
        organizacionId_callId: { organizacionId, callId },
      },
    });
    return fila ? toRow(fila) : null;
  }

  async listar(
    organizacionId: string,
    filtro: FiltroListarLlamadas,
  ): Promise<{ items: WhatsappLlamadaRow[]; total: number; page: number }> {
    const page = Math.max(1, filtro.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filtro.pageSize ?? 20));
    const where: Prisma.WhatsappLlamadaWhereInput = {
      organizacionId,
      ...(filtro.asesorId ? { asignadoUsuarioId: filtro.asesorId } : {}),
      ...(filtro.resultado ? { resultado: filtro.resultado } : {}),
      ...(filtro.leadId ? { leadId: filtro.leadId } : {}),
      ...(filtro.conversacionId
        ? { conversacionId: filtro.conversacionId }
        : {}),
      ...(filtro.desde || filtro.hasta
        ? {
            inicioEn: {
              ...(filtro.desde ? { gte: filtro.desde } : {}),
              ...(filtro.hasta ? { lte: filtro.hasta } : {}),
            },
          }
        : {}),
    };

    const [total, filas] = await Promise.all([
      this.prisma.whatsappLlamada.count({ where }),
      this.prisma.whatsappLlamada.findMany({
        where,
        orderBy: { inicioEn: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items: filas.map(toRow), total, page };
  }

  async actualizar(
    organizacionId: string,
    id: string,
    campos: ActualizarLlamadaCampos,
  ): Promise<WhatsappLlamadaRow | null> {
    const existente = await this.prisma.whatsappLlamada.findFirst({
      where: { id, organizacionId },
    });
    if (!existente) return null;

    const actualizada = await this.prisma.whatsappLlamada.update({
      where: { id },
      data: {
        ...(campos.notaPostLlamada !== undefined
          ? { notaPostLlamada: campos.notaPostLlamada }
          : {}),
        ...(campos.motivo !== undefined ? { motivo: campos.motivo } : {}),
        ...(campos.estado !== undefined ? { estado: campos.estado } : {}),
        ...(campos.resultado !== undefined
          ? { resultado: campos.resultado }
          : {}),
        ...(campos.contestadaEn !== undefined
          ? { contestadaEn: campos.contestadaEn }
          : {}),
        ...(campos.finEn !== undefined ? { finEn: campos.finEn } : {}),
        ...(campos.duracionSeg !== undefined
          ? { duracionSeg: campos.duracionSeg }
          : {}),
        ...(campos.asignadoUsuarioId !== undefined
          ? { asignadoUsuarioId: campos.asignadoUsuarioId }
          : {}),
        ...(campos.errorCodigo !== undefined
          ? { errorCodigo: campos.errorCodigo }
          : {}),
        ...(campos.errorMensaje !== undefined
          ? { errorMensaje: campos.errorMensaje }
          : {}),
        ...(campos.datosCrudos !== undefined
          ? { datosCrudos: campos.datosCrudos as Prisma.InputJsonValue }
          : {}),
      },
    });
    return toRow(actualizada);
  }

  async reclamar(
    organizacionId: string,
    callId: string,
    usuarioId: string,
  ): Promise<WhatsappLlamadaRow | null> {
    const resultado = await this.prisma.whatsappLlamada.updateMany({
      where: {
        organizacionId,
        callId,
        asignadoUsuarioId: null,
        estado: { in: ESTADOS_RECLAMABLES },
      },
      data: { asignadoUsuarioId: usuarioId },
    });
    if (resultado.count === 0) return null;
    return this.findPorCallId(organizacionId, callId);
  }

  async metricas(
    organizacionId: string,
    desde?: Date,
    hasta?: Date,
  ): Promise<MetricasLlamadas> {
    const where: Prisma.WhatsappLlamadaWhereInput = {
      organizacionId,
      ...(desde || hasta
        ? {
            inicioEn: {
              ...(desde ? { gte: desde } : {}),
              ...(hasta ? { lte: hasta } : {}),
            },
          }
        : {}),
    };

    const filas = await this.prisma.whatsappLlamada.findMany({
      where,
      select: {
        resultado: true,
        duracionSeg: true,
        asignadoUsuarioId: true,
        estado: true,
      },
    });

    const contestadas = filas.filter(
      (f) => f.resultado === RESULTADOS_LLAMADA.CONTESTADA,
    ).length;
    const perdidas = filas.filter(
      (f) =>
        f.resultado === RESULTADOS_LLAMADA.NO_CONTESTADA ||
        f.estado === ESTADOS_LLAMADA.MISSED,
    ).length;
    const rechazadas = filas.filter(
      (f) => f.resultado === RESULTADOS_LLAMADA.RECHAZADA,
    ).length;

    const duraciones = filas
      .map((f) => f.duracionSeg)
      .filter((d): d is number => d != null && d >= 0);
    const duracionMediaSeg =
      duraciones.length > 0
        ? Math.round(
            duraciones.reduce((a, b) => a + b, 0) / duraciones.length,
          )
        : null;

    const porAsesorMap = new Map<
      string,
      { contestadas: number; total: number; duraciones: number[] }
    >();
    for (const f of filas) {
      if (!f.asignadoUsuarioId) continue;
      const actual = porAsesorMap.get(f.asignadoUsuarioId) ?? {
        contestadas: 0,
        total: 0,
        duraciones: [],
      };
      actual.total += 1;
      if (f.resultado === RESULTADOS_LLAMADA.CONTESTADA) actual.contestadas += 1;
      if (f.duracionSeg != null) actual.duraciones.push(f.duracionSeg);
      porAsesorMap.set(f.asignadoUsuarioId, actual);
    }

    return {
      contestadas,
      perdidas,
      rechazadas,
      duracionMediaSeg,
      total: filas.length,
      porAsesor: [...porAsesorMap.entries()].map(([asesorId, v]) => ({
        asesorId,
        contestadas: v.contestadas,
        total: v.total,
        duracionMediaSeg:
          v.duraciones.length > 0
            ? Math.round(
                v.duraciones.reduce((a, b) => a + b, 0) / v.duraciones.length,
              )
            : null,
      })),
    };
  }
}
