import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ActualizarVisitaRepoInput,
  CrearVisitaRepoInput,
  InmuebleVisitaResumen,
  LeadVisitasRepository,
  VisitaAgendaRow,
  VisitaDetalle,
  VisitaLeadRow,
} from '../application/ports/lead-visitas.repository.port';

const INMUEBLE_SELECT = { id: true, codigo: true, titulo: true } as const;

function mapInmueble(
  inmueble: { id: string; codigo: string; titulo: string } | null,
): InmuebleVisitaResumen | null {
  return inmueble
    ? { id: inmueble.id, codigo: inmueble.codigo, titulo: inmueble.titulo }
    : null;
}

@Injectable()
export class PrismaLeadVisitasRepository implements LeadVisitasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarAgenda(
    organizacionId: string,
    filtros: {
      desde: Date;
      hasta: Date;
      asignadoUsuarioId?: string;
    },
  ): Promise<VisitaAgendaRow[]> {
    const filas = await this.prisma.leadVisita.findMany({
      where: {
        organizacionId,
        programadaEn: { gte: filtros.desde, lte: filtros.hasta },
        ...(filtros.asignadoUsuarioId
          ? { asignadoUsuarioId: filtros.asignadoUsuarioId }
          : {}),
      },
      include: {
        lead: { select: { id: true, nombre: true, telefono: true } },
        asignadoUsuario: { select: { id: true, nombre: true, apellido: true } },
        inmueble: { select: INMUEBLE_SELECT },
      },
      orderBy: { programadaEn: 'asc' },
    });

    return filas.map((f) => this.mapAgenda(f));
  }

  async listarPorLead(
    organizacionId: string,
    leadId: string,
  ): Promise<VisitaLeadRow[]> {
    const filas = await this.prisma.leadVisita.findMany({
      where: { organizacionId, leadId },
      include: { inmueble: { select: INMUEBLE_SELECT } },
      orderBy: { programadaEn: 'desc' },
    });

    return filas.map((f) => ({
      id: f.id,
      programadaEn: f.programadaEn,
      programadaFin: f.programadaFin,
      duracionMinutos: f.duracionMinutos,
      referenciaInmueble: f.referenciaInmueble,
      inmuebleId: f.inmuebleId,
      inmueble: mapInmueble(f.inmueble),
      modalidad: f.modalidad,
      estado: f.estado,
      resultado: f.resultado,
      nota: f.nota,
      feedback: f.feedback,
      fechaCreacion: f.fechaCreacion,
    }));
  }

  async obtenerPorId(
    organizacionId: string,
    visitaId: string,
  ): Promise<VisitaDetalle | null> {
    const f = await this.prisma.leadVisita.findFirst({
      where: { id: visitaId, organizacionId },
    });
    if (!f) return null;
    return {
      id: f.id,
      leadId: f.leadId,
      programadaEn: f.programadaEn,
      programadaFin: f.programadaFin,
      duracionMinutos: f.duracionMinutos,
      referenciaInmueble: f.referenciaInmueble,
      modalidad: f.modalidad,
      estado: f.estado,
      resultado: f.resultado,
      nota: f.nota,
      feedback: f.feedback,
      asignadoUsuarioId: f.asignadoUsuarioId,
    };
  }

  async crear(
    organizacionId: string,
    input: CrearVisitaRepoInput,
  ): Promise<VisitaAgendaRow> {
    const f = await this.prisma.leadVisita.create({
      data: {
        id: input.id,
        organizacionId,
        leadId: input.leadId,
        programadaEn: input.programadaEn,
        programadaFin: input.programadaFin,
        duracionMinutos: input.duracionMinutos,
        referenciaInmueble: input.referenciaInmueble,
        inmuebleId: input.inmuebleId ?? null,
        modalidad: input.modalidad,
        nota: input.nota,
        estado: 'PROGRAMADA',
        asignadoUsuarioId: input.asignadoUsuarioId,
        creadoPorUsuarioId: input.creadoPorUsuarioId,
      },
      include: {
        lead: { select: { id: true, nombre: true, telefono: true } },
        asignadoUsuario: { select: { id: true, nombre: true, apellido: true } },
        inmueble: { select: INMUEBLE_SELECT },
      },
    });
    return this.mapAgenda(f);
  }

  async actualizar(
    organizacionId: string,
    visitaId: string,
    cambios: ActualizarVisitaRepoInput,
  ): Promise<VisitaAgendaRow> {
    await this.prisma.leadVisita.updateMany({
      where: { id: visitaId, organizacionId },
      data: {
        ...(cambios.programadaEn !== undefined
          ? { programadaEn: cambios.programadaEn }
          : {}),
        ...(cambios.programadaFin !== undefined
          ? { programadaFin: cambios.programadaFin }
          : {}),
        ...(cambios.duracionMinutos !== undefined
          ? { duracionMinutos: cambios.duracionMinutos }
          : {}),
        ...(cambios.referenciaInmueble !== undefined
          ? { referenciaInmueble: cambios.referenciaInmueble }
          : {}),
        ...(cambios.inmuebleId !== undefined
          ? { inmuebleId: cambios.inmuebleId }
          : {}),
        ...(cambios.modalidad !== undefined
          ? { modalidad: cambios.modalidad }
          : {}),
        ...(cambios.estado !== undefined ? { estado: cambios.estado } : {}),
        ...(cambios.resultado !== undefined
          ? { resultado: cambios.resultado }
          : {}),
        ...(cambios.nota !== undefined ? { nota: cambios.nota } : {}),
        ...(cambios.feedback !== undefined
          ? { feedback: cambios.feedback }
          : {}),
      },
    });

    const f = await this.prisma.leadVisita.findFirst({
      where: { id: visitaId, organizacionId },
      include: {
        lead: { select: { id: true, nombre: true, telefono: true } },
        asignadoUsuario: { select: { id: true, nombre: true, apellido: true } },
        inmueble: { select: INMUEBLE_SELECT },
      },
    });
    if (!f) {
      throw new Error('Visita no encontrada tras actualizar');
    }
    return this.mapAgenda(f);
  }

  async cancelarProgramadasDelLead(
    organizacionId: string,
    leadId: string,
  ): Promise<void> {
    await this.prisma.leadVisita.updateMany({
      where: { organizacionId, leadId, estado: 'PROGRAMADA' },
      data: { estado: 'CANCELADA', resultado: 'CANCELADA' },
    });
  }

  async existeSolape(
    organizacionId: string,
    asignadoUsuarioId: string,
    inicio: Date,
    fin: Date,
    excluirVisitaId?: string,
  ): Promise<boolean> {
    const conflicto = await this.prisma.leadVisita.findFirst({
      where: {
        organizacionId,
        asignadoUsuarioId,
        estado: 'PROGRAMADA',
        ...(excluirVisitaId ? { id: { not: excluirVisitaId } } : {}),
        programadaEn: { lt: fin },
        programadaFin: { gt: inicio },
      },
      select: { id: true },
    });
    return Boolean(conflicto);
  }

  private mapAgenda(f: {
    id: string;
    leadId: string;
    programadaEn: Date;
    programadaFin: Date;
    duracionMinutos: number;
    referenciaInmueble: string;
    inmuebleId: string | null;
    modalidad: string;
    estado: string;
    nota: string | null;
    lead: { id: string; nombre: string | null; telefono: string | null };
    asignadoUsuario: {
      id: string;
      nombre: string;
      apellido: string | null;
    } | null;
    inmueble: { id: string; codigo: string; titulo: string } | null;
  }): VisitaAgendaRow {
    return {
      id: f.id,
      leadId: f.leadId,
      leadNombre: f.lead.nombre,
      leadTelefono: f.lead.telefono,
      programadaEn: f.programadaEn,
      programadaFin: f.programadaFin,
      duracionMinutos: f.duracionMinutos,
      referenciaInmueble: f.referenciaInmueble,
      inmuebleId: f.inmuebleId,
      inmueble: mapInmueble(f.inmueble),
      modalidad: f.modalidad,
      estado: f.estado,
      nota: f.nota,
      asignado: f.asignadoUsuario
        ? {
            id: f.asignadoUsuario.id,
            nombre: [f.asignadoUsuario.nombre, f.asignadoUsuario.apellido]
              .filter(Boolean)
              .join(' '),
          }
        : null,
    };
  }
}
