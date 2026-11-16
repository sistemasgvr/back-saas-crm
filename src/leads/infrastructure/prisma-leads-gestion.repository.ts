import {
  construirResultadoPaginado,
  type ResultadoPaginado,
} from '../../shared/application/paginacion';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { bloquearUsuariosEmpresa } from '../../shared/infrastructure/bloquear-usuarios-empresa';
import { lockBotOrganizacion } from '../../whatsapp/messaging/application/bot-organizacion-lock';
import { ControlAtencionService } from '../../whatsapp/messaging/application/control-atencion.service';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  CambiosGestionLead,
  HistorialEstadoRow,
  LeadParaGestion,
  LeadsGestionRepository,
  RegistrarHistorialInput,
} from '../application/ports/leads-gestion.repository.port';

const MENSAJE_ASESOR_CAMBIO =
  'El asesor de este lead cambió mientras tenías la pantalla abierta. Revisa el asesor actual antes de volver a guardar.';

@Injectable()
export class PrismaLeadsGestionRepository implements LeadsGestionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly control: ControlAtencionService,
  ) {}

  async buscarParaGestion(
    organizacionId: string,
    id: string,
  ): Promise<LeadParaGestion | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizacionId, estado: 1 },
      select: {
        id: true,
        nombre: true,
        asignadoUsuarioId: true,
        tipoLead: true,
        estadoGestion: true,
      },
    });
    return lead;
  }

  async tomar(
    organizacionId: string,
    id: string,
    usuarioId: string,
  ): Promise<boolean> {
    // updateMany + where asignado_usuario_id IS NULL: atómico, sin condición
    // de carrera entre el check y el write (PLAN §9).
    const chats = await this.prisma.$transaction(async (tx) => {
      await bloquearUsuariosEmpresa(tx, organizacionId);
      if (!(await this.esMiembroActivo(organizacionId, usuarioId, tx)))
        return null;
      await lockBotOrganizacion(tx, organizacionId);
      const resultado = await tx.lead.updateMany({
        where: { id, organizacionId, estado: 1, asignadoUsuarioId: null },
        data: {
          asignadoUsuarioId: usuarioId,
          asignadoEn: new Date(),
          asignadoPorUsuarioId: null,
          usuarioEdicion: usuarioId,
        },
      });
      if (!resultado.count) return null;
      return this.control.sincronizarAsignacionLead(
        tx,
        organizacionId,
        id,
        usuarioId,
        usuarioId,
      );
    });
    if (!chats) return false;
    this.control.notificarAsignacionLead(organizacionId, id, chats);
    return true;
  }

  async asignar(
    organizacionId: string,
    id: string,
    usuarioId: string,
    asignadoPorUsuarioId: string,
    asesorEsperadoId?: string | null,
  ): Promise<boolean> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      await bloquearUsuariosEmpresa(tx, organizacionId);
      if (!(await this.esMiembroActivo(organizacionId, usuarioId, tx)))
        throw new BadRequestException(
          'El usuario destino no es miembro activo de esta organización',
        );
      await lockBotOrganizacion(tx, organizacionId);
      const { count } = await tx.lead.updateMany({
        where: {
          id,
          organizacionId,
          estado: 1,
          ...(asesorEsperadoId === undefined ? {} : { asignadoUsuarioId: asesorEsperadoId }),
          OR: [{ asignadoUsuarioId: null }, { asignadoUsuarioId: { not: usuarioId } }],
        },
        data: {
          asignadoUsuarioId: usuarioId,
          asignadoEn: new Date(),
          asignadoPorUsuarioId,
          usuarioEdicion: asignadoPorUsuarioId,
        },
      });
      if (!count) {
        const lead = await tx.lead.findFirst({
          where: { id, organizacionId, estado: 1 },
          select: { asignadoUsuarioId: true },
        });
        if (!lead) throw new NotFoundException('Lead no encontrado');
        if (lead.asignadoUsuarioId !== usuarioId) throw new ConflictException(MENSAJE_ASESOR_CAMBIO);
      }
      const chats = await this.control.sincronizarAsignacionLead(
        tx,
        organizacionId,
        id,
        usuarioId,
        asignadoPorUsuarioId,
      );
      return { chats, cambio: count === 1 };
    });
    if (resultado.chats) this.control.notificarAsignacionLead(organizacionId, id, resultado.chats);
    return resultado.cambio;
  }

  async esMiembroActivo(
    organizacionId: string,
    usuarioId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const membresia = await tx.organizacionUsuario.findFirst({
      where: { organizacionId, usuarioId, estado: 1, usuario: { estado: 1 } },
      select: { id: true },
    });
    return membresia !== null;
  }

  async liberar(
    organizacionId: string,
    id: string,
    actorId: string,
    asesorEsperadoId?: string | null,
  ): Promise<void> {
    const chats = await this.prisma.$transaction(async (tx) => {
      await bloquearUsuariosEmpresa(tx, organizacionId);
      await lockBotOrganizacion(tx, organizacionId);
      const { count } = await tx.lead.updateMany({
        where: {
          id, organizacionId, estado: 1,
          ...(asesorEsperadoId === undefined ? {} : { asignadoUsuarioId: asesorEsperadoId }),
        },
        data: {
          asignadoUsuarioId: null,
          asignadoEn: null,
          asignadoPorUsuarioId: null,
          usuarioEdicion: actorId,
        },
      });
      if (!count) {
        const lead = await tx.lead.findFirst({
          where: { id, organizacionId, estado: 1 },
          select: { asignadoUsuarioId: true },
        });
        if (!lead) throw new NotFoundException('Lead no encontrado');
        if (lead.asignadoUsuarioId !== null) throw new ConflictException(MENSAJE_ASESOR_CAMBIO);
        return null;
      }
      return this.control.sincronizarAsignacionLead(
        tx,
        organizacionId,
        id,
        null,
        actorId,
      );
    });
    if (chats) this.control.notificarAsignacionLead(organizacionId, id, chats);
  }

  async actualizarGestion(
    organizacionId: string,
    id: string,
    cambios: CambiosGestionLead,
    usuarioEdicion: string,
    historial?: RegistrarHistorialInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { id, organizacionId, estado: 1 },
        data: {
          ...(cambios.tipoLead !== undefined
            ? { tipoLead: cambios.tipoLead }
            : {}),
          ...(cambios.estadoGestion !== undefined
            ? {
                estadoGestion: cambios.estadoGestion,
                estadoGestionEn: new Date(),
                estadoGestionPorUsuarioId: usuarioEdicion,
              }
            : {}),
          ...(cambios.motivoCierre !== undefined
            ? { motivoCierre: cambios.motivoCierre }
            : {}),
          ...(cambios.notaCierre !== undefined
            ? { notaCierre: cambios.notaCierre }
            : {}),
          ...(cambios.inmuebleInteresId !== undefined
            ? { inmuebleInteresId: cambios.inmuebleInteresId }
            : {}),
          ...(cambios.nombre !== undefined ? { nombre: cambios.nombre } : {}),
          usuarioEdicion,
        },
      });

      if (cambios.nombre !== undefined) {
        await tx.whatsappConversacion.updateMany({
          where: { leadId: id, organizacionId },
          data: { nombreContacto: cambios.nombre },
        });
      }

      if (!historial) return;

      await tx.leadEstadoHistorial.create({
        data: {
          id: historial.id,
          organizacionId: historial.organizacionId,
          leadId: historial.leadId,
          tipoLead: historial.tipoLead,
          desde: historial.desde,
          hacia: historial.hacia,
          motivoCierre: historial.motivoCierre,
          nota: historial.nota,
          metadata: historial.metadata ?? undefined,
          usuarioId: historial.usuarioId,
        },
      });

      if (historial.cerrarVisita) {
        const visitasAbiertas = await tx.leadVisita.findMany({
          where: {
            organizacionId: historial.organizacionId,
            leadId: historial.leadId,
            estado: 'PROGRAMADA',
          },
          orderBy: { programadaEn: 'desc' },
        });
        if (visitasAbiertas.length > 0) {
          const resultado = historial.cerrarVisita.resultado;
          const estado =
            resultado === 'ASISTIO'
              ? 'REALIZADA'
              : resultado === 'NO_SHOW'
                ? 'NO_SHOW'
                : 'CANCELADA';
          // Cierra todas las PROGRAMADA abiertas (no solo la última).
          await tx.leadVisita.updateMany({
            where: {
              id: { in: visitasAbiertas.map((v) => v.id) },
            },
            data: {
              estado,
              resultado,
              feedback: historial.cerrarVisita.feedback,
              historialCierraId: historial.id,
            },
          });
        }
      }

      if (historial.cancelarVisitasProgramadas) {
        await tx.leadVisita.updateMany({
          where: {
            organizacionId: historial.organizacionId,
            leadId: historial.leadId,
            estado: 'PROGRAMADA',
          },
          data: {
            estado: 'CANCELADA',
            resultado: 'CANCELADA',
          },
        });
      }

      // Crear visita DESPUÉS de cancelar abiertas, para no cancelar la nueva.
      if (historial.crearVisita) {
        const v = historial.crearVisita;
        await tx.leadVisita.create({
          data: {
            id: v.id,
            organizacionId: historial.organizacionId,
            leadId: historial.leadId,
            programadaEn: v.programadaEn,
            programadaFin: v.programadaFin,
            duracionMinutos: v.duracionMinutos,
            referenciaInmueble: v.referenciaInmueble,
            inmuebleId: v.inmuebleId ?? null,
            modalidad: v.modalidad,
            nota: v.nota,
            estado: 'PROGRAMADA',
            historialAgendoId: historial.id,
            asignadoUsuarioId: v.asignadoUsuarioId,
            creadoPorUsuarioId: v.creadoPorUsuarioId,
          },
        });
      }

      if (historial.crearCalificacion) {
        const c = historial.crearCalificacion;
        await tx.leadCalificacion.create({
          data: {
            id: c.id,
            organizacionId: historial.organizacionId,
            leadId: historial.leadId,
            tipoLead: c.tipoLead,
            presupuesto: c.presupuesto,
            zona: c.zona,
            tipoInmueble: c.tipoInmueble,
            tipoPropiedad: c.tipoPropiedad,
            precioReferencia: c.precioReferencia,
            nota: c.nota,
            historialId: historial.id,
            usuarioId: c.usuarioId,
          },
        });
      }
    });
  }

  async listarHistorial(
    organizacionId: string,
    leadId: string,
    page = 1,
    pageSize = 20,
  ): Promise<ResultadoPaginado<HistorialEstadoRow>> {
    const filas = await this.prisma.leadEstadoHistorial.findMany({
      where: { organizacionId, leadId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
        visitaAgendo: {
          select: {
            id: true,
            programadaEn: true,
            programadaFin: true,
            duracionMinutos: true,
            referenciaInmueble: true,
            inmuebleId: true,
            modalidad: true,
            estado: true,
            resultado: true,
            nota: true,
            inmueble: { select: { id: true, codigo: true, titulo: true } },
          },
        },
        calificacion: {
          select: {
            id: true,
            presupuesto: true,
            zona: true,
            tipoInmueble: true,
            tipoPropiedad: true,
            precioReferencia: true,
            nota: true,
          },
        },
      },
      orderBy: [{ fechaCreacion: 'desc' }, { id: 'desc' }],
    });
    const total = await this.prisma.leadEstadoHistorial.count({
      where: { organizacionId, leadId },
    });
    return construirResultadoPaginado(
      filas.map((f) => ({
        id: f.id,
        tipoLead: f.tipoLead,
        desde: f.desde,
        hacia: f.hacia,
        motivoCierre: f.motivoCierre,
        nota: f.nota,
        metadata:
          f.metadata &&
          typeof f.metadata === 'object' &&
          !Array.isArray(f.metadata)
            ? (f.metadata as Record<string, string>)
            : null,
        visita: f.visitaAgendo
          ? {
              id: f.visitaAgendo.id,
              programadaEn: f.visitaAgendo.programadaEn,
              programadaFin: f.visitaAgendo.programadaFin,
              duracionMinutos: f.visitaAgendo.duracionMinutos,
              referenciaInmueble: f.visitaAgendo.referenciaInmueble,
              inmuebleId: f.visitaAgendo.inmuebleId,
              inmueble: f.visitaAgendo.inmueble,
              modalidad: f.visitaAgendo.modalidad,
              estado: f.visitaAgendo.estado,
              resultado: f.visitaAgendo.resultado,
              nota: f.visitaAgendo.nota,
            }
          : null,
        calificacion: f.calificacion,
        usuario: f.usuario
          ? {
              id: f.usuario.id,
              nombre: [f.usuario.nombre, f.usuario.apellido]
                .filter(Boolean)
                .join(' '),
            }
          : null,
        fechaCreacion: f.fechaCreacion,
      })),
      total,
      page,
      pageSize,
    );
  }

  async obtenerIdExternoMeta(
    organizacionId: string,
    leadId: string,
  ): Promise<string | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizacionId },
      select: { idExterno: true },
    });
    return lead?.idExterno ?? null;
  }

  async crearDesdeWhatsApp(input: {
    organizacionId: string;
    idExterno: string;
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    tipoLead: string | null;
    datosCrudos: unknown;
    usuarioId: string | null;
    asignadoUsuarioId: string | null;
    historialId: string;
  }): Promise<{ id: string; creado: boolean }> {
    const existente = await this.prisma.lead.findUnique({
      where: {
        organizacionId_idExterno: {
          organizacionId: input.organizacionId,
          idExterno: input.idExterno,
        },
      },
      select: { id: true },
    });
    if (existente) {
      return { id: existente.id, creado: false };
    }

    return this.prisma.$transaction(async (tx) => {
      const ahora = new Date();
      let asignadoUsuarioId = input.asignadoUsuarioId;
      if (asignadoUsuarioId) {
        await bloquearUsuariosEmpresa(tx, input.organizacionId);
        if (
          !(await this.esMiembroActivo(
            input.organizacionId,
            asignadoUsuarioId,
            tx,
          ))
        )
          asignadoUsuarioId = null;
      }
      const lead = await tx.lead.create({
        data: {
          organizacionId: input.organizacionId,
          idExterno: input.idExterno,
          nombre: input.nombre,
          email: input.email,
          telefono: input.telefono,
          tipoLead: input.tipoLead,
          origen: 'WHATSAPP',
          datosCrudos: input.datosCrudos as object,
          fechaLead: ahora,
          estadoGestion: 'NUEVO',
          estadoGestionEn: ahora,
          estadoGestionPorUsuarioId: input.usuarioId,
          asignadoUsuarioId,
          asignadoEn: asignadoUsuarioId ? ahora : null,
          asignadoPorUsuarioId: null,
          usuarioCreacion: input.usuarioId,
          estadoHistorial: {
            create: {
              id: input.historialId,
              organizacionId: input.organizacionId,
              tipoLead: input.tipoLead,
              desde: null,
              hacia: 'NUEVO',
              nota: 'Lead creado desde chat de WhatsApp',
              metadata: { origen: 'whatsapp_chat' },
              usuarioId: input.usuarioId,
            },
          },
        },
        select: { id: true },
      });
      return { id: lead.id, creado: true };
    });
  }

  async buscarIdPorIdentidadWhatsApp(
    organizacionId: string,
    conversacionId: string,
  ): Promise<string | null> {
    const [lead] = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH contacto AS (
        SELECT
          c.bsuid,
          c.wa_id,
          right(regexp_replace(c.wa_id, '[^0-9]', '', 'g'), 9) AS sufijo,
          conexion.waba_id
        FROM whatsapp_conversaciones c
        JOIN whatsapp_conexiones conexion ON conexion.id = c.whatsapp_conexion_id
        WHERE c.organizacion_id = ${organizacionId}::uuid
          AND c.id = ${conversacionId}::uuid
      )
      SELECT l.id
      FROM leads l
      CROSS JOIN contacto
      WHERE l.organizacion_id = ${organizacionId}::uuid
        AND l.estado = 1
        AND (
          (length(contacto.sufijo) = 9
            AND right(regexp_replace(l.telefono, '[^0-9]', '', 'g'), 9) = contacto.sufijo)
          OR EXISTS (
            SELECT 1
            FROM whatsapp_conversaciones anterior
            JOIN whatsapp_conexiones conexion ON conexion.id = anterior.whatsapp_conexion_id
            WHERE anterior.organizacion_id = l.organizacion_id
              AND anterior.lead_id = l.id
              AND anterior.estado = 1
              AND (
                anterior.wa_id = contacto.wa_id
                OR (anterior.bsuid = contacto.bsuid AND conexion.waba_id = contacto.waba_id)
              )
          )
        )
      ORDER BY (l.asignado_usuario_id IS NOT NULL) DESC,
        l.asignado_en DESC NULLS LAST, l.fecha_creacion DESC, l.id
      LIMIT 1
    `;
    return lead?.id ?? null;
  }

  async completarNombreSiVacio(
    organizacionId: string,
    leadId: string,
    nombre: string,
  ): Promise<boolean> {
    const limpio = nombre.trim();
    if (!limpio) return false;
    const result = await this.prisma.lead.updateMany({
      where: {
        id: leadId,
        organizacionId,
        estado: 1,
        OR: [{ nombre: null }, { nombre: '' }],
      },
      data: { nombre: limpio },
    });
    return result.count > 0;
  }
}
