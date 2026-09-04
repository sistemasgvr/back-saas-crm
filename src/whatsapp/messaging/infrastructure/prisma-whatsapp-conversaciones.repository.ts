import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  ContactoMensajeRow,
  ConversacionResumen,
  FiltroVisibilidadChats,
  InteractivoMensajeRow,
  MediaMensaje,
  MensajeParaReenviar,
  MensajeResuelto,
  MensajeRow,
  RegistrarMensajeInput,
  WhatsappConversacionesRepository,
} from '../application/ports/whatsapp-conversaciones.repository.port';
import { ultimosDigitos, telefonoAWaId } from './normalizar-telefono';

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
      bloqueado: c.bloqueado === 1,
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
    return this.mapearResumen(c);
  }

  async findActivaPorLeadId(
    organizacionId: string,
    leadId: string,
  ): Promise<ConversacionResumen | null> {
    const c = await this.prisma.whatsappConversacion.findFirst({
      where: { organizacionId, leadId, estado: 1 },
      include: {
        lead: { select: { id: true, nombre: true, asignadoUsuarioId: true } },
        mensajes: { orderBy: { fechaMensaje: 'desc' }, take: 1 },
      },
      orderBy: { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
    });
    if (!c) return null;
    return this.mapearResumen(c);
  }

  private mapearResumen(c: {
    id: string;
    waId: string;
    nombreContacto: string | null;
    ultimoMensajeEn: Date | null;
    ventanaExpiraEn: Date | null;
    noLeidos: number;
    bloqueado: number;
    lead: {
      id: string;
      nombre: string | null;
      asignadoUsuarioId: string | null;
    } | null;
    mensajes: { texto: string | null }[];
  }): ConversacionResumen {
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
      bloqueado: c.bloqueado === 1,
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
      include: {
        respondeA: {
          select: {
            id: true,
            direccion: true,
            tipo: true,
            texto: true,
            mediaId: true,
            mediaCaption: true,
          },
        },
      },
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
      reaccionAgente: m.reaccionAgente,
      reaccionCliente: m.reaccionCliente,
      respondeA: m.respondeA
        ? {
            id: m.respondeA.id,
            direccion: m.respondeA.direccion,
            tipo: m.respondeA.tipo,
            texto: m.respondeA.texto,
            tieneMedia: m.respondeA.mediaId !== null,
            mediaCaption: m.respondeA.mediaCaption,
          }
        : null,
      ubicacion:
        m.ubicacionLatitud !== null && m.ubicacionLongitud !== null
          ? {
              latitud: m.ubicacionLatitud,
              longitud: m.ubicacionLongitud,
              nombre: m.ubicacionNombre,
              direccion: m.ubicacionDireccion,
            }
          : null,
      contactos:
        (m.contactos as unknown as ContactoMensajeRow[] | null) ?? null,
      fechaEdicion: m.fechaEdicion,
      interactivo:
        (m.interactivo as unknown as InteractivoMensajeRow | null) ?? null,
    }));
  }

  async buscarMensajePorId(
    organizacionId: string,
    mensajeId: string,
  ): Promise<MensajeResuelto | null> {
    const mensaje = await this.prisma.whatsappMensaje.findFirst({
      where: { id: mensajeId, organizacionId },
      select: { id: true, wamid: true, whatsappConversacionId: true },
    });
    return mensaje;
  }

  async buscarIdPorWamid(
    organizacionId: string,
    wamid: string,
  ): Promise<string | null> {
    const mensaje = await this.prisma.whatsappMensaje.findFirst({
      where: { organizacionId, wamid },
      select: { id: true },
    });
    return mensaje?.id ?? null;
  }

  async actualizarReaccionAgente(
    organizacionId: string,
    mensajeId: string,
    emoji: string | null,
  ): Promise<void> {
    await this.prisma.whatsappMensaje.updateMany({
      where: { id: mensajeId, organizacionId },
      data: { reaccionAgente: emoji },
    });
  }

  async actualizarReaccionCliente(
    organizacionId: string,
    wamidObjetivo: string,
    emoji: string | null,
  ): Promise<void> {
    await this.prisma.whatsappMensaje.updateMany({
      where: { organizacionId, wamid: wamidObjetivo },
      data: { reaccionCliente: emoji },
    });
  }

  async actualizarMensajeEditado(
    organizacionId: string,
    wamidOriginal: string,
    cambios: { texto?: string; mediaCaption?: string },
    fechaEdicion: Date,
  ): Promise<void> {
    await this.prisma.whatsappMensaje.updateMany({
      where: { organizacionId, wamid: wamidOriginal },
      data: {
        ...(cambios.texto !== undefined ? { texto: cambios.texto } : {}),
        ...(cambios.mediaCaption !== undefined
          ? { mediaCaption: cambios.mediaCaption }
          : {}),
        fechaEdicion,
      },
    });
  }

  async marcarLeida(id: string): Promise<void> {
    await this.prisma.whatsappConversacion.update({
      where: { id },
      data: { noLeidos: 0 },
    });
  }

  async buscarUltimoWamidEntrante(
    whatsappConversacionId: string,
  ): Promise<string | null> {
    const mensaje = await this.prisma.whatsappMensaje.findFirst({
      where: { whatsappConversacionId, direccion: 'entrante' },
      orderBy: { fechaMensaje: 'desc' },
      select: { wamid: true },
    });
    return mensaje?.wamid ?? null;
  }

  async vincularLeadPorTelefono(
    organizacionId: string,
    leadId: string,
    telefono: string,
  ): Promise<number> {
    const sufijo = ultimosDigitos(telefono);
    if (!sufijo) return 0;

    const waIdExacto = telefonoAWaId(telefono);
    const resultado = await this.prisma.whatsappConversacion.updateMany({
      where: {
        organizacionId,
        estado: 1,
        leadId: null,
        OR: [
          { waId: { endsWith: sufijo } },
          ...(waIdExacto ? [{ waId: waIdExacto }] : []),
        ],
      },
      data: { leadId },
    });
    return resultado.count;
  }

  async findOCrearConversacion(input: {
    organizacionId: string;
    whatsappConexionId: string;
    waId: string;
    nombreContacto?: string;
    leadIdConocido?: string;
  }): Promise<{ id: string; esNueva: boolean }> {
    const existenteExacto = await this.prisma.whatsappConversacion.findUnique({
      where: {
        organizacionId_waId: {
          organizacionId: input.organizacionId,
          waId: input.waId,
        },
      },
    });
    // Ecos de coexistencia a veces traen `to` con '+' u otro formato; el
    // chat ya existe con el wa_id del webhook entrante. Emparejar por sufijo.
    const existente =
      existenteExacto ??
      (ultimosDigitos(input.waId)
        ? await this.prisma.whatsappConversacion.findFirst({
            where: {
              organizacionId: input.organizacionId,
              estado: 1,
              waId: { endsWith: ultimosDigitos(input.waId) },
            },
            orderBy: { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
          })
        : null);
    if (existente) {
      if (input.leadIdConocido && !existente.leadId) {
        await this.prisma.whatsappConversacion.update({
          where: { id: existente.id },
          data: { leadId: input.leadIdConocido },
        });
      }
      return { id: existente.id, esNueva: false };
    }

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
        respondeAMensajeId: input.respondeAMensajeId,
        ubicacionLatitud: input.ubicacionLatitud,
        ubicacionLongitud: input.ubicacionLongitud,
        ubicacionNombre: input.ubicacionNombre,
        ubicacionDireccion: input.ubicacionDireccion,
        contactos: input.contactos
          ? (input.contactos as unknown as Prisma.InputJsonValue)
          : undefined,
        interactivo: input.interactivo
          ? (input.interactivo as unknown as Prisma.InputJsonValue)
          : undefined,
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

  async actualizarTrasSaliente(
    conversacionId: string,
    fechaMensaje: Date,
  ): Promise<void> {
    await this.prisma.whatsappConversacion.update({
      where: { id: conversacionId },
      data: { ultimoMensajeEn: fechaMensaje },
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
      SET estado_entrega = ${estado},
          texto = CASE WHEN ${estado} = 'eliminado' THEN NULL ELSE texto END,
          media_caption = CASE WHEN ${estado} = 'eliminado' THEN NULL ELSE media_caption END
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

  async marcarMensajeEliminadoEnCrm(
    organizacionId: string,
    mensajeId: string,
  ): Promise<boolean> {
    const resultado = await this.prisma.whatsappMensaje.updateMany({
      where: { id: mensajeId, organizacionId },
      data: {
        estadoEntrega: 'eliminado',
        texto: null,
        mediaCaption: null,
      },
    });
    return resultado.count > 0;
  }

  async marcarBloqueado(
    conversacionId: string,
    bloqueado: boolean,
  ): Promise<void> {
    await this.prisma.whatsappConversacion.update({
      where: { id: conversacionId },
      data: { bloqueado: bloqueado ? 1 : 0 },
    });
  }

  async buscarMensajeParaReenviar(
    organizacionId: string,
    mensajeId: string,
  ): Promise<MensajeParaReenviar | null> {
    const mensaje = await this.prisma.whatsappMensaje.findFirst({
      where: { id: mensajeId, organizacionId },
      include: { media: true },
    });
    if (!mensaje) return null;
    return {
      id: mensaje.id,
      whatsappConversacionId: mensaje.whatsappConversacionId,
      tipo: mensaje.tipo,
      texto: mensaje.texto,
      mediaMimeType: mensaje.mediaMimeType,
      mediaNombreArchivo: mensaje.mediaNombreArchivo,
      mediaCaption: mensaje.mediaCaption,
      mediaEsVoz: mensaje.mediaEsVoz,
      mediaBytes: mensaje.media ? Buffer.from(mensaje.media.bytes) : null,
      ubicacionLatitud: mensaje.ubicacionLatitud,
      ubicacionLongitud: mensaje.ubicacionLongitud,
      ubicacionNombre: mensaje.ubicacionNombre,
      ubicacionDireccion: mensaje.ubicacionDireccion,
      contactos:
        (mensaje.contactos as unknown as
          | ContactoMensajeRow
          | ContactoMensajeRow[]
          | null) ?? null,
    };
  }
}
