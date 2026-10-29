import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  VincularNumeroInput,
  WhatsappConexionRow,
  WhatsappConexionesRepository,
} from '../application/ports/whatsapp-conexiones.repository.port';

function toRow(row: {
  id: string;
  organizacionId: string;
  metaConexionId: string;
  wabaId: string;
  phoneNumberId: string;
  numeroDisplay: string | null;
  nombreVerificado: string | null;
  estadoNumero: string | null;
  rolLinea: string;
  callingHabilitado: number;
  callingUltimoError: string | null;
  webhookSuscrito: number;
  webhookSuscritoEn: Date | null;
  webhookUltimoCheckEn: Date | null;
  webhookUltimoError: string | null;
  fechaCreacion: Date;
}): WhatsappConexionRow {
  return {
    ...row,
    callingHabilitado: row.callingHabilitado === 1,
    webhookSuscrito: row.webhookSuscrito === 1,
  };
}

@Injectable()
export class PrismaWhatsappConexionesRepository implements WhatsappConexionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerUltimoMensajeEntrante(
    organizacionId: string,
    conexionId: string,
  ): Promise<Date | null> {
    const result = await this.prisma.whatsappMensaje.aggregate({
      where: {
        organizacionId,
        direccion: 'entrante',
        whatsappConversacion: { whatsappConexionId: conexionId },
      },
      _max: { fechaCreacion: true },
    });
    return result._max.fechaCreacion;
  }

  async listarPorOrganizacion(
    organizacionId: string,
  ): Promise<WhatsappConexionRow[]> {
    const filas = await this.prisma.whatsappConexion.findMany({
      where: { organizacionId, estado: 1 },
      orderBy: { fechaCreacion: 'asc' },
    });
    return filas.map(toRow);
  }

  async listarPhoneNumberIdsVinculados(
    organizacionId: string,
  ): Promise<string[]> {
    const filas = await this.prisma.whatsappConexion.findMany({
      where: { organizacionId, estado: 1 },
      select: { phoneNumberId: true },
    });
    return filas.map((f) => f.phoneNumberId);
  }

  async findPorId(
    organizacionId: string,
    id: string,
  ): Promise<WhatsappConexionRow | null> {
    const fila = await this.prisma.whatsappConexion.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    return fila ? toRow(fila) : null;
  }

  async findPorPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsappConexionRow | null> {
    const fila = await this.prisma.whatsappConexion.findFirst({
      where: { phoneNumberId, estado: 1 },
    });
    return fila ? toRow(fila) : null;
  }

  async findPorWabaId(wabaId: string): Promise<WhatsappConexionRow | null> {
    const fila = await this.prisma.whatsappConexion.findFirst({
      where: { wabaId, estado: 1 },
      orderBy: { fechaCreacion: 'asc' },
    });
    return fila ? toRow(fila) : null;
  }

  async listarPorWabaId(wabaId: string): Promise<WhatsappConexionRow[]> {
    const filas = await this.prisma.whatsappConexion.findMany({
      where: { wabaId, estado: 1 },
      orderBy: { fechaCreacion: 'asc' },
    });
    return filas.map(toRow);
  }

  async actualizarDatosMeta(
    id: string,
    datos: { estadoNumero?: string; nombreVerificado?: string },
  ): Promise<void> {
    if (!datos.estadoNumero && !datos.nombreVerificado) return;
    await this.prisma.whatsappConexion.update({
      where: { id },
      data: {
        ...(datos.estadoNumero ? { estadoNumero: datos.estadoNumero } : {}),
        ...(datos.nombreVerificado
          ? { nombreVerificado: datos.nombreVerificado }
          : {}),
      },
    });
  }

  async vincular(input: VincularNumeroInput): Promise<WhatsappConexionRow> {
    const existente = await this.prisma.whatsappConexion.findFirst({
      where: {
        organizacionId: input.organizacionId,
        phoneNumberId: input.phoneNumberId,
      },
      orderBy: [{ estado: 'desc' }, { fechaModificacion: 'desc' }],
    });

    const nuevaVinculacion =
      !existente ||
      existente.estado !== 1 ||
      existente.metaConexionId !== input.metaConexionId ||
      existente.wabaId !== input.wabaId;
    const data = {
      metaConexionId: input.metaConexionId,
      wabaId: input.wabaId,
      numeroDisplay: input.numeroDisplay,
      nombreVerificado: input.nombreVerificado,
      // undefined en Prisma conserva el valor anterior (p. ej. DISCONNECTED).
      // Sin una lectura nueva, el estado debe quedar desconocido.
      estadoNumero: input.estadoNumero ?? null,
      webhookSuscrito: 0,
      webhookSuscritoEn: null,
      webhookUltimoCheckEn: null,
      webhookUltimoError: null,
      ...(nuevaVinculacion
        ? { callingHabilitado: 0, callingUltimoError: null }
        : {}),
      estado: 1,
      usuarioEdicion: input.usuarioEdicion,
    };

    const conexion = existente
      ? await this.prisma.whatsappConexion.update({
          where: { id: existente.id },
          data,
        })
      : await this.prisma.whatsappConexion.create({
          data: {
            organizacionId: input.organizacionId,
            phoneNumberId: input.phoneNumberId,
            usuarioCreacion: input.usuarioEdicion,
            ...data,
          },
        });

    return toRow(conexion);
  }

  async desvincular(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<WhatsappConexionRow | null> {
    const existente = await this.prisma.whatsappConexion.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    if (!existente) return null;

    const conexion = await this.prisma.$transaction(async (tx) => {
      // Un diálogo de alta abierto antes de desvincular no debe poder
      // reutilizar después su grant pendiente para esta línea.
      await tx.whatsappOnboarding.updateMany({
        where: {
          organizacionId,
          metaConexionId: existente.metaConexionId,
          estado: 'TOKEN',
          OR: [{ wabaId: null }, { wabaId: existente.wabaId }],
        },
        data: { estado: 'CANCELADO', tokenCifrado: '' },
      });
      return tx.whatsappConexion.update({
        where: { id },
        // Desvinculación local: conserva historial e identificadores. No llama
        // a deregister ni desvincula WhatsApp Business del teléfono.
        data: {
          estado: 0,
          estadoNumero: null,
          webhookSuscrito: 0,
          webhookSuscritoEn: null,
          webhookUltimoCheckEn: null,
          webhookUltimoError: null,
          callingHabilitado: 0,
          callingUltimoError: null,
          usuarioEdicion,
        },
      });
    });
    return toRow(conexion);
  }

  async marcarWebhookSuscrito(
    id: string,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.whatsappConexion.update({
      where: { id },
      data: {
        webhookSuscrito: 1,
        webhookSuscritoEn: new Date(),
        webhookUltimoCheckEn: new Date(),
        webhookUltimoError: null,
        usuarioEdicion,
      },
    });
  }

  async marcarWebhookCheck(
    id: string,
    suscrito: boolean,
    error: string | null,
  ): Promise<void> {
    await this.prisma.whatsappConexion.update({
      where: { id },
      data: {
        webhookSuscrito: suscrito ? 1 : 0,
        webhookUltimoCheckEn: new Date(),
        webhookUltimoError: error,
      },
    });
  }

  async actualizarRolLinea(
    organizacionId: string,
    id: string,
    rolLinea: string,
    usuarioEdicion: string,
  ): Promise<WhatsappConexionRow | null> {
    const existente = await this.prisma.whatsappConexion.findFirst({
      where: { id, organizacionId, estado: 1 },
    });
    if (!existente) return null;

    const conexion = await this.prisma.whatsappConexion.update({
      where: { id },
      data: { rolLinea, usuarioEdicion },
    });
    return toRow(conexion);
  }

  async actualizarCallingHabilitado(
    id: string,
    habilitado: boolean,
    error: string | null,
  ): Promise<void> {
    await this.prisma.whatsappConexion.update({
      where: { id },
      data: {
        callingHabilitado: habilitado ? 1 : 0,
        callingUltimoError: error,
      },
    });
  }
}
