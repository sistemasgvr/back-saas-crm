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
  webhookSuscrito: number;
  webhookSuscritoEn: Date | null;
  webhookUltimoCheckEn: Date | null;
  webhookUltimoError: string | null;
  fechaCreacion: Date;
}): WhatsappConexionRow {
  return { ...row, webhookSuscrito: row.webhookSuscrito === 1 };
}

@Injectable()
export class PrismaWhatsappConexionesRepository implements WhatsappConexionesRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async vincular(input: VincularNumeroInput): Promise<WhatsappConexionRow> {
    const existente = await this.prisma.whatsappConexion.findFirst({
      where: {
        organizacionId: input.organizacionId,
        phoneNumberId: input.phoneNumberId,
      },
    });

    const data = {
      metaConexionId: input.metaConexionId,
      wabaId: input.wabaId,
      numeroDisplay: input.numeroDisplay,
      nombreVerificado: input.nombreVerificado,
      estadoNumero: input.estadoNumero,
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

    const conexion = await this.prisma.whatsappConexion.update({
      where: { id },
      data: { estado: 0, usuarioEdicion },
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
}
