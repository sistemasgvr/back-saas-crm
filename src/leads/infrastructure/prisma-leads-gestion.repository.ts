import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  CambiosGestionLead,
  HistorialEstadoRow,
  LeadParaGestion,
  LeadsGestionRepository,
  RegistrarHistorialInput,
} from '../application/ports/leads-gestion.repository.port';

@Injectable()
export class PrismaLeadsGestionRepository implements LeadsGestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarParaGestion(
    organizacionId: string,
    id: string,
  ): Promise<LeadParaGestion | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizacionId, estado: 1 },
      select: {
        id: true,
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
    const resultado = await this.prisma.lead.updateMany({
      where: { id, organizacionId, estado: 1, asignadoUsuarioId: null },
      data: {
        asignadoUsuarioId: usuarioId,
        asignadoEn: new Date(),
        asignadoPorUsuarioId: null,
        usuarioEdicion: usuarioId,
      },
    });
    return resultado.count === 1;
  }

  async asignar(
    organizacionId: string,
    id: string,
    usuarioId: string,
    asignadoPorUsuarioId: string,
  ): Promise<void> {
    await this.prisma.lead.updateMany({
      where: { id, organizacionId, estado: 1 },
      data: {
        asignadoUsuarioId: usuarioId,
        asignadoEn: new Date(),
        asignadoPorUsuarioId,
        usuarioEdicion: asignadoPorUsuarioId,
      },
    });
  }

  async esMiembroActivo(
    organizacionId: string,
    usuarioId: string,
  ): Promise<boolean> {
    const membresia = await this.prisma.organizacionUsuario.findFirst({
      where: { organizacionId, usuarioId, estado: 1, usuario: { estado: 1 } },
      select: { id: true },
    });
    return membresia !== null;
  }

  async liberar(organizacionId: string, id: string): Promise<void> {
    await this.prisma.lead.updateMany({
      where: { id, organizacionId, estado: 1 },
      data: {
        asignadoUsuarioId: null,
        asignadoEn: null,
        asignadoPorUsuarioId: null,
      },
    });
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
          usuarioEdicion,
        },
      });

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

      if (historial.crearVisita) {
        const v = historial.crearVisita;
        await tx.leadVisita.create({
          data: {
            id: v.id,
            organizacionId: historial.organizacionId,
            leadId: historial.leadId,
            programadaEn: v.programadaEn,
            referenciaInmueble: v.referenciaInmueble,
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

      if (historial.cerrarVisita) {
        const visitaAbierta = await tx.leadVisita.findFirst({
          where: {
            organizacionId: historial.organizacionId,
            leadId: historial.leadId,
            estado: 'PROGRAMADA',
          },
          orderBy: { programadaEn: 'desc' },
        });
        if (visitaAbierta) {
          const resultado = historial.cerrarVisita.resultado;
          const estado =
            resultado === 'ASISTIO'
              ? 'REALIZADA'
              : resultado === 'NO_SHOW'
                ? 'NO_SHOW'
                : 'CANCELADA';
          await tx.leadVisita.update({
            where: { id: visitaAbierta.id },
            data: {
              estado,
              resultado,
              feedback: historial.cerrarVisita.feedback,
              historialCierraId: historial.id,
            },
          });
        }
      }
    });
  }

  async listarHistorial(
    organizacionId: string,
    leadId: string,
  ): Promise<HistorialEstadoRow[]> {
    const filas = await this.prisma.leadEstadoHistorial.findMany({
      where: { organizacionId, leadId },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
        visitaAgendo: {
          select: {
            id: true,
            programadaEn: true,
            referenciaInmueble: true,
            modalidad: true,
            estado: true,
            resultado: true,
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
      orderBy: { fechaCreacion: 'asc' },
    });
    return filas.map((f) => ({
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
      visita: f.visitaAgendo,
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
    }));
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
}
