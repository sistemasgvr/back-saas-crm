import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  ConversacionResumen,
  FiltroVisibilidadChats,
  MensajeRow,
  RegistrarMensajeInput,
  WhatsappConversacionesRepository,
} from '../application/ports/whatsapp-conversaciones.repository.port';
import { ultimosDigitos } from './normalizar-telefono';

const VENTANA_HORAS = 24;

@Injectable()
export class PrismaWhatsappConversacionesRepository implements WhatsappConversacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private whereVisibilidad(
    filtro: FiltroVisibilidadChats,
  ): Prisma.WhatsappConversacionWhereInput {
    if (filtro.modo === 'todos') return {};
    return { lead: { asignadoUsuarioId: filtro.usuarioId } };
  }

  async listar(
    organizacionId: string,
    filtro: FiltroVisibilidadChats,
  ): Promise<ConversacionResumen[]> {
    const conversaciones = await this.prisma.whatsappConversacion.findMany({
      where: {
        organizacionId,
        estado: 1,
        ...this.whereVisibilidad(filtro),
      },
      include: {
        lead: { select: { id: true, nombre: true, asignadoUsuarioId: true } },
        mensajes: { orderBy: { fechaMensaje: 'desc' }, take: 1 },
      },
      orderBy: { ultimoMensajeEn: 'desc' },
    });

    return conversaciones.map((c) => ({
      id: c.id,
      waId: c.waId,
      nombreContacto: c.nombreContacto,
      lead: c.lead
        ? {
            id: c.lead.id,
            nombre: c.lead.nombre ?? c.waId,
            asignadoUsuarioId: c.lead.asignadoUsuarioId,
          }
        : null,
      ultimoMensajeEn: c.ultimoMensajeEn,
      ventanaExpiraEn: c.ventanaExpiraEn,
      noLeidos: c.noLeidos,
      ultimoMensajeTexto: c.mensajes[0]?.texto ?? null,
    }));
  }

  async findPorId(
    organizacionId: string,
    id: string,
  ): Promise<ConversacionResumen | null> {
    const c = await this.prisma.whatsappConversacion.findFirst({
      where: { id, organizacionId, estado: 1 },
      include: {
        lead: { select: { id: true, nombre: true, asignadoUsuarioId: true } },
        mensajes: { orderBy: { fechaMensaje: 'desc' }, take: 1 },
      },
    });
    if (!c) return null;
    return {
      id: c.id,
      waId: c.waId,
      nombreContacto: c.nombreContacto,
      lead: c.lead
        ? {
            id: c.lead.id,
            nombre: c.lead.nombre ?? c.waId,
            asignadoUsuarioId: c.lead.asignadoUsuarioId,
          }
        : null,
      ultimoMensajeEn: c.ultimoMensajeEn,
      ventanaExpiraEn: c.ventanaExpiraEn,
      noLeidos: c.noLeidos,
      ultimoMensajeTexto: c.mensajes[0]?.texto ?? null,
    };
  }

  async listarMensajes(
    whatsappConversacionId: string,
    limite: number,
  ): Promise<MensajeRow[]> {
    const mensajes = await this.prisma.whatsappMensaje.findMany({
      where: { whatsappConversacionId },
      orderBy: { fechaMensaje: 'asc' },
      take: limite,
    });
    return mensajes.map((m) => ({
      id: m.id,
      wamid: m.wamid,
      direccion: m.direccion,
      tipo: m.tipo,
      texto: m.texto,
      plantillaNombre: m.plantillaNombre,
      estadoEntrega: m.estadoEntrega,
      fechaMensaje: m.fechaMensaje,
    }));
  }

  async marcarLeida(id: string): Promise<void> {
    await this.prisma.whatsappConversacion.update({
      where: { id },
      data: { noLeidos: 0 },
    });
  }

  async findOCrearConversacion(input: {
    organizacionId: string;
    whatsappConexionId: string;
    waId: string;
    nombreContacto?: string;
  }): Promise<{ id: string; esNueva: boolean }> {
    const existente = await this.prisma.whatsappConversacion.findUnique({
      where: {
        organizacionId_waId: {
          organizacionId: input.organizacionId,
          waId: input.waId,
        },
      },
    });
    if (existente) return { id: existente.id, esNueva: false };

    // Intento de vínculo con un lead existente por teléfono — heurística MVP
    // por sufijo de dígitos (ultimosDigitos), no cobertura 100% de formatos.
    const sufijo = ultimosDigitos(input.waId);
    const leadCandidato = sufijo
      ? await this.prisma.lead.findFirst({
          where: {
            organizacionId: input.organizacionId,
            estado: 1,
            telefono: { contains: sufijo },
          },
          orderBy: { fechaCreacion: 'desc' },
        })
      : null;

    const conversacion = await this.prisma.whatsappConversacion.create({
      data: {
        organizacionId: input.organizacionId,
        whatsappConexionId: input.whatsappConexionId,
        waId: input.waId,
        nombreContacto: input.nombreContacto,
        leadId: leadCandidato?.id,
      },
    });
    return { id: conversacion.id, esNueva: true };
  }

  async registrarMensaje(
    input: RegistrarMensajeInput,
  ): Promise<{ id: string; creado: boolean }> {
    const existente = await this.prisma.whatsappMensaje.findUnique({
      where: {
        organizacionId_wamid: {
          organizacionId: input.organizacionId,
          wamid: input.wamid,
        },
      },
    });
    if (existente) return { id: existente.id, creado: false };

    const mensaje = await this.prisma.whatsappMensaje.create({
      data: {
        organizacionId: input.organizacionId,
        whatsappConversacionId: input.whatsappConversacionId,
        wamid: input.wamid,
        direccion: input.direccion,
        tipo: input.tipo,
        texto: input.texto,
        plantillaNombre: input.plantillaNombre,
        estadoEntrega: input.estadoEntrega,
        datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
        fechaMensaje: input.fechaMensaje,
        usuarioCreacion: input.usuarioCreacion,
      },
    });
    return { id: mensaje.id, creado: true };
  }

  async actualizarTrasEntrante(
    conversacionId: string,
    fechaMensaje: Date,
    nombreContacto?: string,
  ): Promise<void> {
    const ventanaExpiraEn = new Date(
      fechaMensaje.getTime() + VENTANA_HORAS * 60 * 60 * 1000,
    );
    await this.prisma.whatsappConversacion.update({
      where: { id: conversacionId },
      data: {
        ultimoMensajeEn: fechaMensaje,
        ventanaExpiraEn,
        noLeidos: { increment: 1 },
        ...(nombreContacto ? { nombreContacto } : {}),
      },
    });
  }

  async actualizarEstadoMensaje(
    organizacionId: string,
    wamid: string,
    estado: string,
  ): Promise<void> {
    await this.prisma.whatsappMensaje.updateMany({
      where: { organizacionId, wamid },
      data: { estadoEntrega: estado },
    });
  }
}
