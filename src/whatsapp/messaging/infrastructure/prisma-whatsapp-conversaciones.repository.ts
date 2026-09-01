import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  ConversacionResumen,
  FiltroVisibilidadChats,
  MediaMensaje,
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
      // Postgres pone los NULL primero en un ORDER BY ... DESC por defecto —
      // sin "nulls: 'last'" las conversaciones sin ningún mensaje todavía
      // (ultimoMensajeEn null) se colaban arriba de todo, antes que chats
      // con actividad reciente real.
      orderBy: { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
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

  async contarNoLeidos(
    organizacionId: string,
    filtro: FiltroVisibilidadChats,
  ): Promise<number> {
    // Cantidad de CHATS con algo pendiente, no la suma de mensajes de cada
    // uno — mismo criterio que el badge de WhatsApp: un chat con 6 mensajes
    // sin leer cuenta 1, no 6.
    return this.prisma.whatsappConversacion.count({
      where: {
        organizacionId,
        estado: 1,
        noLeidos: { gt: 0 },
        ...this.whereVisibilidad(filtro),
      },
    });
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
      tieneMedia: m.mediaId !== null,
      mediaMimeType: m.mediaMimeType,
      mediaNombreArchivo: m.mediaNombreArchivo,
      mediaCaption: m.mediaCaption,
      mediaEsVoz: m.mediaEsVoz,
      mediaTamanoBytes: m.mediaTamanoBytes,
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
    leadIdConocido?: string;
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

    // Si viene un lead conocido (CTA "Iniciar chat" desde su ficha) se usa
    // directo — evita el riesgo de que la heurística de sufijo empareje con
    // otro lead cuyo teléfono coincida por casualidad.
    let leadId = input.leadIdConocido;
    if (!leadId) {
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
      leadId = leadCandidato?.id;
    }

    const conversacion = await this.prisma.whatsappConversacion.create({
      data: {
        organizacionId: input.organizacionId,
        whatsappConexionId: input.whatsappConexionId,
        waId: input.waId,
        nombreContacto: input.nombreContacto,
        leadId,
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
        mediaId: input.mediaId,
        mediaMimeType: input.mediaMimeType,
        mediaNombreArchivo: input.mediaNombreArchivo,
        mediaCaption: input.mediaCaption,
        mediaEsVoz: input.mediaEsVoz,
        mediaTamanoBytes: input.mediaTamanoBytes,
        ...(input.mediaBytes
          ? { media: { create: { bytes: input.mediaBytes } } }
          : {}),
      },
    });
    return { id: mensaje.id, creado: true };
  }

  async obtenerMedia(
    organizacionId: string,
    mensajeId: string,
  ): Promise<MediaMensaje | null> {
    const mensaje = await this.prisma.whatsappMensaje.findFirst({
      where: { id: mensajeId, organizacionId },
      include: { media: true },
    });
    if (!mensaje?.media) return null;
    return {
      // Prisma mapea Bytes a Uint8Array, no a Buffer — Buffer.from() sobre un
      // Uint8Array no copia los bytes, solo envuelve el mismo buffer.
      bytes: Buffer.from(mensaje.media.bytes),
      mimeType: mensaje.mediaMimeType ?? 'application/octet-stream',
      nombreArchivo: mensaje.mediaNombreArchivo,
    };
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
    // Meta no garantiza el orden de los webhooks de estado — puede llegar
    // "read" antes que "delivered" (documentado por Meta). Sin esto, un
    // "delivered" tardío pisaría un "leido" ya guardado y el check volvería
    // a verse gris. "fallido"/"eliminado" son terminales y siempre se
    // aplican, sin importar el orden.
    await this.prisma.$executeRaw`
      UPDATE whatsapp_mensajes
      SET estado_entrega = ${estado}
      WHERE organizacion_id = ${organizacionId}::uuid
        AND wamid = ${wamid}
        AND (
          ${estado} IN ('fallido', 'eliminado')
          OR estado_entrega IS NULL
          OR COALESCE(
               CASE estado_entrega WHEN 'enviado' THEN 1 WHEN 'entregado' THEN 2 WHEN 'leido' THEN 3 ELSE 0 END,
               0
             ) <= COALESCE(
               CASE ${estado} WHEN 'enviado' THEN 1 WHEN 'entregado' THEN 2 WHEN 'leido' THEN 3 ELSE 0 END,
               0
             )
        )
    `;
  }
}
