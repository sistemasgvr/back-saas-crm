import {
  construirResultadoPaginado,
  type ResultadoPaginado,
} from '../../../shared/application/paginacion';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type WhatsappConversacion } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  ContactoMensajeRow,
  ConversacionResumen,
  FiltroVisibilidadChats,
  InteractivoMensajeRow,
  LeadEnConversacion,
  MediaMensajeMeta,
  MensajeParaReenviar,
  MensajeResuelto,
  MensajeRow,
  RegistrarMensajeInput,
  WhatsappConversacionesRepository,
} from '../application/ports/whatsapp-conversaciones.repository.port';
import { ultimosDigitos, telefonoAWaId } from './normalizar-telefono';
import { previewUltimoMensajeWhatsApp } from '../application/preview-ultimo-mensaje';
import { etiquetaContactoWhatsApp } from '../domain/identidad-contacto-whatsapp';
import { recuperarTextoDesdeDatosCrudos } from '../../../meta/webhooks/domain/extraer-contenido-mensaje-meta';

const VENTANA_HORAS = 24;

function textoMensajeConRecuperacion(m: {
  texto: string | null;
  datosCrudos?: unknown;
}): string | null {
  const actual = m.texto?.trim();
  if (actual) return m.texto;
  return recuperarTextoDesdeDatosCrudos(m.datosCrudos);
}

function previewDesdeMensaje(m: {
  texto: string | null;
  mediaCaption: string | null;
  tipo: string;
  mediaEsVoz: boolean | null;
  datosCrudos?: unknown;
}): string | null {
  return previewUltimoMensajeWhatsApp({
    texto: textoMensajeConRecuperacion(m),
    mediaCaption: m.mediaCaption,
    tipo: m.tipo,
    mediaEsVoz: m.mediaEsVoz,
  });
}

const LEAD_CON_INMUEBLE_SELECT = {
  id: true,
  nombre: true,
  origen: true,
  asignadoUsuarioId: true,
  asignadoUsuario: { select: { id: true, nombre: true, apellido: true } },
  inmuebleInteres: { select: { id: true, codigo: true, titulo: true } },
} as const;

function nombreUsuario(u: { nombre: string; apellido: string | null }): string {
  return [u.nombre, u.apellido].filter(Boolean).join(' ');
}

function mapearLead(
  lead: {
    id: string;
    nombre: string | null;
    origen: string;
    asignadoUsuarioId: string | null;
    asignadoUsuario: {
      id: string;
      nombre: string;
      apellido: string | null;
    } | null;
    inmuebleInteres: { id: string; codigo: string; titulo: string } | null;
  } | null,
  nombreFallback: string,
): LeadEnConversacion | null {
  if (!lead) return null;
  return {
    id: lead.id,
    nombre: lead.nombre ?? nombreFallback,
    origen: lead.origen,
    asignadoUsuarioId: lead.asignadoUsuarioId,
    asignado: lead.asignadoUsuario
      ? {
          id: lead.asignadoUsuario.id,
          nombre: nombreUsuario(lead.asignadoUsuario),
        }
      : null,
    inmuebleInteres: lead.inmuebleInteres
      ? {
          id: lead.inmuebleInteres.id,
          codigo: lead.inmuebleInteres.codigo,
          titulo: lead.inmuebleInteres.titulo,
        }
      : null,
  };
}

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
    pagination = { page: 1, pageSize: 20 } as {
      page: number;
      pageSize: number;
      q?: string;
      borradores?: string;
    },
  ): Promise<ResultadoPaginado<ConversacionResumen>> {
    const { page, pageSize } = pagination;
    const q = pagination.q?.trim();
    const draftIds =
      pagination.borradores
        ?.split(',')
        .filter((id) =>
          /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
        ) ?? [];
    const where: Prisma.WhatsappConversacionWhereInput = {
      organizacionId,
      estado: 1,
      ...this.whereVisibilidad(filtro),
      ...(q
        ? {
            OR: [
              ...['nombreContacto', 'waId', 'username', 'bsuid'].map(
                (campo) => ({
                  [campo]: {
                    contains: q.replace(/^@/, ''),
                    mode: 'insensitive',
                  },
                }),
              ),
              { lead: { nombre: { contains: q, mode: 'insensitive' } } },
              {
                mensajes: {
                  some: { texto: { contains: q, mode: 'insensitive' } },
                },
              },
              ...(q.replace(/\D/g, '').length >= 3
                ? [{ waId: { contains: q.replace(/\D/g, '') } }]
                : []),
              { id: { in: draftIds } },
            ],
          }
        : {}),
    };
    const total = await this.prisma.whatsappConversacion.count({ where });
    const conversaciones = await this.prisma.whatsappConversacion.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        lead: { select: LEAD_CON_INMUEBLE_SELECT },
        mensajes: {
          orderBy: [{ fechaMensaje: 'desc' }, { fechaCreacion: 'desc' }],
          take: 1,
        },
      },
      // Postgres pone los NULL primero en un ORDER BY ... DESC por defecto —
      // sin "nulls: 'last'" las conversaciones sin ningún mensaje todavía
      // (ultimoMensajeEn null) se colaban arriba de todo, antes que chats
      // con actividad reciente real.
      orderBy: [
        { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
    });

    const data = conversaciones
      .map((c) => {
        const etiqueta = etiquetaContactoWhatsApp({
          nombre: c.nombreContacto,
          username: c.username,
          waId: c.waId,
          bsuid: c.bsuid,
        });
        return {
          id: c.id,
          whatsappConexionId: c.whatsappConexionId,
          modoAtencion: c.modoAtencion,
          controlVersion: c.controlVersion,
          controlUsuarioId: c.controlUsuarioId,
          waId: c.waId,
          bsuid: c.bsuid,
          username: c.username,
          nombreContacto: c.nombreContacto,
          lead: mapearLead(c.lead, etiqueta),
          // Preferir la fecha del último mensaje real (sanación si ultimoMensajeEn quedó atrasado).
          ultimoMensajeEn: c.mensajes[0]?.fechaMensaje ?? c.ultimoMensajeEn,
          ventanaExpiraEn: c.ventanaExpiraEn,
          noLeidos: c.noLeidos,
          ultimoMensajeTexto: previewDesdeMensaje(
            c.mensajes[0] ?? {
              texto: null,
              mediaCaption: null,
              tipo: '',
              mediaEsVoz: null,
            },
          ),
          bloqueado: c.bloqueado === 1,
        };
      })
      .sort((a, b) => {
        const ta = a.ultimoMensajeEn?.getTime() ?? 0;
        const tb = b.ultimoMensajeEn?.getTime() ?? 0;
        return tb - ta;
      });
    return construirResultadoPaginado(data, total, page, pageSize);
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
        lead: { select: LEAD_CON_INMUEBLE_SELECT },
        mensajes: {
          orderBy: [{ fechaMensaje: 'desc' }, { fechaCreacion: 'desc' }],
          take: 1,
        },
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
        lead: { select: LEAD_CON_INMUEBLE_SELECT },
        mensajes: {
          orderBy: [{ fechaMensaje: 'desc' }, { fechaCreacion: 'desc' }],
          take: 1,
        },
      },
      orderBy: { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
    });
    if (!c) return null;
    return this.mapearResumen(c);
  }

  private mapearResumen(c: {
    whatsappConexionId: string;
    modoAtencion: string;
    controlVersion: number;
    controlUsuarioId: string | null;
    id: string;
    waId: string | null;
    bsuid: string | null;
    username: string | null;
    nombreContacto: string | null;
    ultimoMensajeEn: Date | null;
    ventanaExpiraEn: Date | null;
    noLeidos: number;
    bloqueado: number;
    lead: {
      id: string;
      nombre: string | null;
      origen: string;
      asignadoUsuarioId: string | null;
      asignadoUsuario: {
        id: string;
        nombre: string;
        apellido: string | null;
      } | null;
      inmuebleInteres: { id: string; codigo: string; titulo: string } | null;
    } | null;
    mensajes: {
      texto: string | null;
      mediaCaption: string | null;
      tipo: string;
      mediaEsVoz: boolean | null;
      fechaMensaje?: Date;
      datosCrudos?: unknown;
    }[];
  }): ConversacionResumen {
    const etiqueta = etiquetaContactoWhatsApp({
      nombre: c.nombreContacto,
      username: c.username,
      waId: c.waId,
      bsuid: c.bsuid,
    });
    return {
      id: c.id,
      whatsappConexionId: c.whatsappConexionId,
      modoAtencion: c.modoAtencion,
      controlVersion: c.controlVersion,
      controlUsuarioId: c.controlUsuarioId,
      waId: c.waId,
      bsuid: c.bsuid,
      username: c.username,
      nombreContacto: c.nombreContacto,
      lead: mapearLead(c.lead, etiqueta),
      ultimoMensajeEn: c.mensajes[0]?.fechaMensaje ?? c.ultimoMensajeEn,
      ventanaExpiraEn: c.ventanaExpiraEn,
      noLeidos: c.noLeidos,
      ultimoMensajeTexto: previewDesdeMensaje(
        c.mensajes[0] ?? {
          texto: null,
          mediaCaption: null,
          tipo: '',
          mediaEsVoz: null,
        },
      ),
      bloqueado: c.bloqueado === 1,
    };
  }

  async listarMensajes(
    whatsappConversacionId: string,
    limite: number,
    before?: string,
  ): Promise<MensajeRow[]> {
    if (before) {
      const cursor = await this.prisma.whatsappMensaje.findFirst({
        where: { id: before, whatsappConversacionId },
        select: { id: true },
      });
      if (!cursor)
        throw new NotFoundException(
          'Mensaje no encontrado en esta conversación',
        );
    }
    // Meta a veces marca varios mensajes con el mismo segundo (ecos /
    // envíos en lote). Desempatar por fechaCreacion = orden de llegada real.
    // Pedimos los más recientes y los devolvemos ascendente para el chat.
    const recientes = await this.prisma.whatsappMensaje.findMany({
      where: { whatsappConversacionId },
      orderBy: [
        { fechaMensaje: 'desc' },
        { fechaCreacion: 'desc' },
        { id: 'desc' },
      ],
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
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
    const mensajes = recientes.slice().reverse();
    return mensajes.map((m) => ({
      id: m.id,
      autorTipo: m.autorTipo,
      wamid: m.wamid,
      direccion: m.direccion,
      tipo: m.tipo,
      texto: textoMensajeConRecuperacion(m),
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
  ): Promise<string | null> {
    const filas = await this.prisma.whatsappMensaje.updateManyAndReturn({
      where: { organizacionId, wamid: wamidObjetivo },
      data: { reaccionCliente: emoji },
      select: { whatsappConversacionId: true },
    });
    return filas[0]?.whatsappConversacionId ?? null;
  }

  async actualizarMensajeEditado(
    organizacionId: string,
    wamidOriginal: string,
    cambios: { texto?: string; mediaCaption?: string },
    fechaEdicion: Date,
  ): Promise<string | null> {
    const filas = await this.prisma.whatsappMensaje.updateManyAndReturn({
      where: { organizacionId, wamid: wamidOriginal },
      data: {
        ...(cambios.texto !== undefined ? { texto: cambios.texto } : {}),
        ...(cambios.mediaCaption !== undefined
          ? { mediaCaption: cambios.mediaCaption }
          : {}),
        fechaEdicion,
      },
      select: { whatsappConversacionId: true },
    });
    return filas[0]?.whatsappConversacionId ?? null;
  }

  async tieneMediaPendiente(mensajeId: string): Promise<boolean> {
    const mensaje = await this.prisma.whatsappMensaje.findUnique({
      where: { id: mensajeId },
      select: { mediaId: true, media: { select: { mediaObjetoId: true } } },
    });
    return Boolean(mensaje?.mediaId) && !mensaje?.media?.mediaObjetoId;
  }

  async adjuntarMedia(
    mensajeId: string,
    media: { mediaObjetoId: string; mimeType: string; tamanoBytes: number },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const vinculo = await tx.whatsappMensajeMedia.findUnique({
        where: { whatsappMensajeId: mensajeId },
        select: { mediaObjetoId: true },
      });
      if (vinculo?.mediaObjetoId) return;
      await tx.whatsappMensajeMedia.upsert({
        where: { whatsappMensajeId: mensajeId },
        create: {
          whatsappMensajeId: mensajeId,
          mediaObjetoId: media.mediaObjetoId,
        },
        update: { mediaObjetoId: media.mediaObjetoId },
      });
      await tx.whatsappMediaObjeto.update({
        where: { id: media.mediaObjetoId },
        data: { usos: { increment: 1 } },
      });
      await tx.whatsappMensaje.update({
        where: { id: mensajeId },
        data: {
          mediaMimeType: media.mimeType,
          mediaTamanoBytes: media.tamanoBytes,
        },
      });
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
      orderBy: [{ fechaMensaje: 'desc' }, { fechaCreacion: 'desc' }],
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

  async asignarLeadSiLibre(
    organizacionId: string,
    conversacionId: string,
    leadId: string,
  ): Promise<boolean> {
    const resultado = await this.prisma.whatsappConversacion.updateMany({
      where: {
        id: conversacionId,
        organizacionId,
        estado: 1,
        leadId: null,
      },
      data: { leadId },
    });
    return resultado.count === 1;
  }

  async findOCrearConversacion(input: {
    organizacionId: string;
    whatsappConexionId: string;
    waId?: string | null;
    bsuid?: string | null;
    username?: string | null;
    nombreContacto?: string;
    leadIdConocido?: string;
  }): Promise<{ id: string; esNueva: boolean }> {
    const waId = input.waId?.replace(/\D/g, '') || null;
    const bsuid = input.bsuid?.trim() || null;
    const username = input.username?.trim() || null;

    if (!waId && !bsuid) {
      throw new Error(
        'findOCrearConversacion requiere waId o bsuid del contacto WhatsApp',
      );
    }

    let existente: {
      id: string;
      leadId: string | null;
      waId: string | null;
      bsuid: string | null;
      username: string | null;
      nombreContacto: string | null;
    } | null = null;

    if (waId) {
      const existenteExacto = await this.prisma.whatsappConversacion.findUnique(
        {
          where: {
            organizacionId_whatsappConexionId_waId: {
              organizacionId: input.organizacionId,
              whatsappConexionId: input.whatsappConexionId,
              waId,
            },
          },
        },
      );
      // Ecos de coexistencia a veces traen `to` con '+' u otro formato; el
      // chat ya existe con el wa_id del webhook entrante. Emparejar por sufijo.
      existente =
        existenteExacto ??
        (ultimosDigitos(waId)
          ? await this.prisma.whatsappConversacion.findFirst({
              where: {
                organizacionId: input.organizacionId,
                whatsappConexionId: input.whatsappConexionId,
                estado: 1,
                waId: { endsWith: ultimosDigitos(waId) },
              },
              orderBy: { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
            })
          : null);
    }

    // Si no había wa_id (o no matcheó) y hay BSUID, buscar por identidad estable.
    // Cubre el caso: chat creado solo con BSUID y luego Meta manda también teléfono.
    if (!existente && bsuid) {
      existente = await this.prisma.whatsappConversacion.findFirst({
        where: {
          organizacionId: input.organizacionId,
          whatsappConexionId: input.whatsappConexionId,
          bsuid,
          estado: 1,
        },
        orderBy: { ultimoMensajeEn: { sort: 'desc', nulls: 'last' } },
      });
    }

    if (existente) {
      const data: {
        leadId?: string;
        waId?: string;
        bsuid?: string;
        username?: string;
        nombreContacto?: string;
      } = {};
      if (input.leadIdConocido && !existente.leadId) {
        data.leadId = input.leadIdConocido;
      }
      if (waId && !existente.waId) data.waId = waId;
      if (bsuid && !existente.bsuid) data.bsuid = bsuid;
      if (username && !existente.username) data.username = username;
      if (input.nombreContacto && !existente.nombreContacto) {
        data.nombreContacto = input.nombreContacto;
      }
      if (Object.keys(data).length > 0) {
        await this.prisma.whatsappConversacion.update({
          where: { id: existente.id },
          data,
        });
      }
      // Lead vacío + chat con nombre de perfil → copiar (no pisa CRM).
      const nombreRelleno =
        (data.nombreContacto ?? existente.nombreContacto)?.trim() || null;
      if (existente.leadId && nombreRelleno) {
        await this.prisma.lead.updateMany({
          where: {
            id: existente.leadId,
            organizacionId: input.organizacionId,
            estado: 1,
            OR: [{ nombre: null }, { nombre: '' }],
          },
          data: { nombre: nombreRelleno },
        });
      }
      return { id: existente.id, esNueva: false };
    }

    // Si viene un lead conocido (CTA "Iniciar chat" desde su ficha) se usa
    // directo — evita el riesgo de que la heurística de sufijo empareje con
    // otro lead cuyo teléfono coincida por casualidad.
    let leadId = input.leadIdConocido;
    if (!leadId && waId) {
      const sufijo = ultimosDigitos(waId);
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

    let conversacion: WhatsappConversacion;
    let esNueva = true;
    try {
      conversacion = await this.prisma.whatsappConversacion.create({
        data: {
          organizacionId: input.organizacionId,
          whatsappConexionId: input.whatsappConexionId,
          waId,
          bsuid,
          username,
          nombreContacto: input.nombreContacto,
          leadId,
        },
      });
    } catch (error: unknown) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const recien = await this.prisma.whatsappConversacion.findFirst({
        where: {
          organizacionId: input.organizacionId,
          whatsappConexionId: input.whatsappConexionId,
          OR: [...(waId ? [{ waId }] : []), ...(bsuid ? [{ bsuid }] : [])],
        },
      });
      if (!recien) throw error;
      conversacion = recien;
      esNueva = false;
    }
    const nombreRelleno = input.nombreContacto?.trim() || null;
    if (leadId && nombreRelleno) {
      await this.prisma.lead.updateMany({
        where: {
          id: leadId,
          organizacionId: input.organizacionId,
          estado: 1,
          OR: [{ nombre: null }, { nombre: '' }],
        },
        data: { nombre: nombreRelleno },
      });
    }
    return { id: conversacion.id, esNueva };
  }

  async registrarMensaje(
    input: RegistrarMensajeInput,
  ): Promise<{ id: string; creado: boolean }> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.organizacionId.toLowerCase() + ':' + input.whatsappConversacionId.toLowerCase()}, 0))::text`;
        const c = await tx.whatsappConversacion.findFirst({
          where: {
            id: input.whatsappConversacionId,
            organizacionId: input.organizacionId,
          },
        });
        if (!c) throw new Error('Conversación fuera de la organización');
        const existente = await tx.whatsappMensaje.findUnique({
          where: {
            organizacionId_wamid: {
              organizacionId: input.organizacionId,
              wamid: input.wamid,
            },
          },
        });
        if (existente) {
          if (existente.whatsappConversacionId !== input.whatsappConversacionId)
            throw new Error('wamid pertenece a otra conversación');
          const intento = await tx.whatsappSalidaIntento.findFirst({
            where: {
              organizacionId: input.organizacionId,
              conversacionId: input.whatsappConversacionId,
              wamid: input.wamid,
            },
          });
          if (intento) {
            await tx.whatsappMensaje.update({
              where: { id: existente.id },
              data: {
                autorTipo: intento.actor,
                usuarioCreacion: intento.usuarioId,
              },
            });
            await tx.whatsappSalidaIntento.update({
              where: { id: intento.id },
              data: { mensajePersistido: true },
            });
          }
          return { id: existente.id, creado: false };
        }
        const intento =
          input.direccion === 'saliente'
            ? await tx.whatsappSalidaIntento.findFirst({
                where: {
                  organizacionId: input.organizacionId,
                  conversacionId: input.whatsappConversacionId,
                  wamid: input.wamid,
                },
              })
            : null;

        // Si Meta (o un lote local) repite el mismo segundo, desplazar +1ms para
        // que el orden cronológico coincida con el de llegada/envío.
        const fechaMensaje = await this.fechaMensajeSinColision(
          input.whatsappConversacionId,
          input.fechaMensaje,
          tx,
        );

        const mensaje = await tx.whatsappMensaje.create({
          data: {
            organizacionId: input.organizacionId,
            whatsappConversacionId: input.whatsappConversacionId,
            wamid: input.wamid,
            direccion: input.direccion,
            autorTipo:
              intento?.actor ??
              input.autorTipo ??
              (input.direccion === 'entrante'
                ? 'CUSTOMER'
                : input.usuarioCreacion
                  ? 'HUMAN'
                  : 'UNKNOWN'),
            tipo: input.tipo,
            texto: input.texto,
            plantillaNombre: input.plantillaNombre,
            estadoEntrega: input.estadoEntrega,
            datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
            fechaMensaje,
            usuarioCreacion: intento?.usuarioId ?? input.usuarioCreacion,
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
            ...(input.mediaObjetoId
              ? { media: { create: { mediaObjetoId: input.mediaObjetoId } } }
              : {}),
          },
        });

        if (input.direccion === 'entrante' && !input.esHistorial) {
          await tx.whatsappConversacion.update({
            where: { id: input.whatsappConversacionId },
            data: { entradaRevision: { increment: 1 } },
          });
        }
        if (input.mediaObjetoId) {
          await tx.whatsappMediaObjeto.update({
            where: { id: input.mediaObjetoId },
            data: { usos: { increment: 1 } },
          });
        }

        // Lista de chats ordena/muestra por ultimoMensajeEn. Varios envíos
        // salientes del CRM olvidaban llamar actualizarTrasSaliente — al
        // actualizar aquí el preview y la hora quedan alineados con el mensaje.
        // Responder = ya se leyó el chat (mismo criterio que WhatsApp).
        await tx.whatsappConversacion.update({
          where: { id: input.whatsappConversacionId },
          data: {
            ultimoMensajeEn: fechaMensaje,
            ...(input.direccion === 'saliente' ? { noLeidos: 0 } : {}),
          },
        });

        if (intento)
          await tx.whatsappSalidaIntento.update({
            where: { id: intento.id },
            data: { mensajePersistido: true },
          });
        return { id: mensaje.id, creado: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /** Evita empates de segundo (Meta / lotes): el nuevo mensaje queda justo después. */
  private async fechaMensajeSinColision(
    whatsappConversacionId: string,
    fecha: Date,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Date> {
    const segundoInicio = new Date(Math.floor(fecha.getTime() / 1000) * 1000);
    const segundoFin = new Date(segundoInicio.getTime() + 1000);
    const ultimoEnSegundo = await db.whatsappMensaje.findFirst({
      where: {
        whatsappConversacionId,
        fechaMensaje: { gte: segundoInicio, lt: segundoFin },
      },
      orderBy: [{ fechaMensaje: 'desc' }, { fechaCreacion: 'desc' }],
      select: { fechaMensaje: true },
    });
    if (!ultimoEnSegundo) return fecha;
    if (ultimoEnSegundo.fechaMensaje.getTime() < fecha.getTime()) return fecha;
    return new Date(ultimoEnSegundo.fechaMensaje.getTime() + 1);
  }

  async obtenerMedia(
    organizacionId: string,
    mensajeId: string,
  ): Promise<MediaMensajeMeta | null> {
    const mensaje = await this.prisma.whatsappMensaje.findFirst({
      where: { id: mensajeId, organizacionId },
      include: {
        media: { include: { mediaObjeto: true } },
      },
    });
    if (!mensaje?.media?.mediaObjeto) return null;
    return {
      objectKey: mensaje.media.mediaObjeto.objectKey,
      mimeType:
        mensaje.mediaMimeType ??
        mensaje.media.mediaObjeto.mimeType ??
        'application/octet-stream',
      nombreArchivo: mensaje.mediaNombreArchivo,
      tamanoBytes:
        mensaje.mediaTamanoBytes ?? mensaje.media.mediaObjeto.tamanoBytes,
    };
  }

  async actualizarTrasEntrante(
    conversacionId: string,
    fechaMensaje: Date,
    opciones?: { incrementarNoLeidos?: boolean; extenderVentana?: boolean },
  ): Promise<void> {
    const incrementarNoLeidos = opciones?.incrementarNoLeidos !== false;
    const extenderVentana = opciones?.extenderVentana !== false;
    const ventanaExpiraEn = extenderVentana
      ? new Date(fechaMensaje.getTime() + VENTANA_HORAS * 60 * 60 * 1000)
      : null;

    // Solo avanza orden/ventana si el mensaje es más nuevo que el último
    // (history/out-of-order no debe cerrar ni abrir la ventana 24h).
    await this.prisma.$executeRaw`
      UPDATE whatsapp_conversaciones
      SET
        ultimo_mensaje_en = CASE
          WHEN ultimo_mensaje_en IS NULL OR ultimo_mensaje_en < ${fechaMensaje}
          THEN ${fechaMensaje}
          ELSE ultimo_mensaje_en
        END,
        ventana_expira_en = CASE
          WHEN ${extenderVentana} = false THEN ventana_expira_en
          WHEN ventana_expira_en IS NULL OR ventana_expira_en < ${ventanaExpiraEn}
          THEN ${ventanaExpiraEn}
          ELSE ventana_expira_en
        END,
        no_leidos = CASE
          WHEN ${incrementarNoLeidos} THEN no_leidos + 1
          ELSE no_leidos
        END
      WHERE id = ${conversacionId}::uuid
    `;
  }

  async renombrar(
    organizacionId: string,
    conversacionId: string,
    nombre: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const conversacion = await tx.whatsappConversacion.findFirst({
        where: { id: conversacionId, organizacionId },
        select: { leadId: true },
      });
      if (!conversacion) return;
      await tx.whatsappConversacion.update({
        where: { id: conversacionId },
        data: { nombreContacto: nombre },
      });
      if (conversacion.leadId) {
        await tx.lead.updateMany({
          where: {
            id: conversacion.leadId,
            organizacionId,
            estado: 1,
          },
          data: { nombre },
        });
      }
    });
  }

  async buscarIdPorContacto(input: {
    organizacionId: string;
    whatsappConexionId: string;
    waId?: string | null;
    bsuid?: string | null;
  }): Promise<string | null> {
    const waId = input.waId?.replace(/\D/g, '') || null;
    const bsuid = input.bsuid?.trim() || null;
    const base = {
      organizacionId: input.organizacionId,
      whatsappConexionId: input.whatsappConexionId,
      estado: 1,
    };
    const orderBy = {
      ultimoMensajeEn: { sort: 'desc', nulls: 'last' },
    } as const;

    if (waId) {
      // Mismo criterio que findOCrearConversacion: exacto y luego por sufijo.
      const exacto = await this.prisma.whatsappConversacion.findFirst({
        where: { ...base, waId },
        select: { id: true },
      });
      if (exacto) return exacto.id;
      const sufijo = ultimosDigitos(waId);
      if (sufijo) {
        const porSufijo = await this.prisma.whatsappConversacion.findFirst({
          where: { ...base, waId: { endsWith: sufijo } },
          orderBy,
          select: { id: true },
        });
        if (porSufijo) return porSufijo.id;
      }
    }
    if (bsuid) {
      const porBsuid = await this.prisma.whatsappConversacion.findFirst({
        where: { ...base, bsuid },
        orderBy,
        select: { id: true },
      });
      if (porBsuid) return porBsuid.id;
    }
    return null;
  }

  async actualizarNombreDesdeContactoApp(input: {
    organizacionId: string;
    whatsappConexionId: string;
    waId: string;
    nombre: string;
  }): Promise<boolean> {
    const id = await this.buscarIdPorContacto(input);
    if (!id) return false;
    await this.prisma.$transaction(async (tx) => {
      const conversacion = await tx.whatsappConversacion.update({
        where: { id },
        data: { nombreContacto: input.nombre },
        select: { leadId: true },
      });
      if (conversacion.leadId) {
        // No pisa el nombre que el CRM ya tenga en el lead.
        await tx.lead.updateMany({
          where: {
            id: conversacion.leadId,
            organizacionId: input.organizacionId,
            estado: 1,
            OR: [{ nombre: null }, { nombre: '' }],
          },
          data: { nombre: input.nombre },
        });
      }
    });
    return true;
  }

  async actualizarTrasSaliente(
    conversacionId: string,
    fechaMensaje: Date,
    opciones?: { limpiarNoLeidos?: boolean },
  ): Promise<void> {
    const limpiarNoLeidos = opciones?.limpiarNoLeidos !== false;
    await this.prisma.$executeRaw`
      UPDATE whatsapp_conversaciones
      SET
        ultimo_mensaje_en = CASE
          WHEN ultimo_mensaje_en IS NULL OR ultimo_mensaje_en < ${fechaMensaje}
          THEN ${fechaMensaje}
          ELSE ultimo_mensaje_en
        END,
        no_leidos = CASE
          WHEN ${limpiarNoLeidos} THEN 0
          ELSE no_leidos
        END
      WHERE id = ${conversacionId}::uuid
    `;
  }

  async actualizarEstadoMensaje(
    organizacionId: string,
    wamid: string,
    estado: string,
  ): Promise<string | null> {
    // Meta no garantiza el orden de los webhooks de estado — puede llegar
    // "read" antes que "delivered" (documentado por Meta). Sin esto, un
    // "delivered" tardío pisaría un "leido" ya guardado y el check volvería
    // a verse gris. "fallido"/"eliminado" son terminales y siempre se
    // aplican, sin importar el orden.
    // RETURNING: solo si el estado efectivamente cambió se avisa en vivo.
    const filas = await this.prisma.$queryRaw<
      { whatsapp_conversacion_id: string }[]
    >`
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
        AND estado_entrega IS DISTINCT FROM ${estado}
      RETURNING whatsapp_conversacion_id
    `;
    return filas[0]?.whatsapp_conversacion_id ?? null;
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
      include: {
        media: { include: { mediaObjeto: true } },
      },
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
      mediaObjetoId: mensaje.media?.mediaObjetoId ?? null,
      mediaObjectKey: mensaje.media?.mediaObjeto?.objectKey ?? null,
      ubicacionLatitud: mensaje.ubicacionLatitud,
      ubicacionLongitud: mensaje.ubicacionLongitud,
      ubicacionNombre: mensaje.ubicacionNombre,
      ubicacionDireccion: mensaje.ubicacionDireccion,
      contactos:
        (mensaje.contactos as unknown as
          ContactoMensajeRow | ContactoMensajeRow[] | null) ?? null,
    };
  }
}
