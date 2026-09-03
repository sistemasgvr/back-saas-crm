import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ActividadAgendaRow,
  ActividadDetalle,
  ActualizarActividadRepoInput,
  CrearActividadRepoInput,
  LeadActividadesRepository,
} from '../application/ports/lead-actividades.repository.port';

@Injectable()
export class PrismaLeadActividadesRepository implements LeadActividadesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarAgenda(
    organizacionId: string,
    filtros: {
      desde: Date;
      hasta: Date;
      asignadoUsuarioId?: string;
    },
  ): Promise<ActividadAgendaRow[]> {
    const filas = await this.prisma.leadActividad.findMany({
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
      },
      orderBy: { programadaEn: 'asc' },
    });
    return filas.map((f) => this.mapAgenda(f));
  }

  async obtenerPorId(
    organizacionId: string,
    actividadId: string,
  ): Promise<ActividadDetalle | null> {
    const f = await this.prisma.leadActividad.findFirst({
      where: { id: actividadId, organizacionId },
    });
    if (!f) return null;
    return {
      id: f.id,
      leadId: f.leadId,
      tipo: f.tipo,
      titulo: f.titulo,
      programadaEn: f.programadaEn,
      programadaFin: f.programadaFin,
      duracionMinutos: f.duracionMinutos,
      referenciaInmueble: f.referenciaInmueble,
      modalidad: f.modalidad,
      estado: f.estado,
      nota: f.nota,
      asignadoUsuarioId: f.asignadoUsuarioId,
    };
  }

  async crear(
    organizacionId: string,
    input: CrearActividadRepoInput,
  ): Promise<ActividadAgendaRow> {
    const f = await this.prisma.leadActividad.create({
      data: {
        id: input.id,
        organizacionId,
        leadId: input.leadId,
        tipo: input.tipo,
        titulo: input.titulo,
        programadaEn: input.programadaEn,
        programadaFin: input.programadaFin,
        duracionMinutos: input.duracionMinutos,
        referenciaInmueble: input.referenciaInmueble,
        modalidad: input.modalidad,
        nota: input.nota,
        estado: 'PROGRAMADA',
        asignadoUsuarioId: input.asignadoUsuarioId,
        creadoPorUsuarioId: input.creadoPorUsuarioId,
      },
      include: {
        lead: { select: { id: true, nombre: true, telefono: true } },
        asignadoUsuario: { select: { id: true, nombre: true, apellido: true } },
      },
    });
    return this.mapAgenda(f);
  }

  async actualizar(
    organizacionId: string,
    actividadId: string,
    cambios: ActualizarActividadRepoInput,
  ): Promise<ActividadAgendaRow> {
    await this.prisma.leadActividad.updateMany({
      where: { id: actividadId, organizacionId },
      data: {
        ...(cambios.tipo !== undefined ? { tipo: cambios.tipo } : {}),
        ...(cambios.titulo !== undefined ? { titulo: cambios.titulo } : {}),
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
        ...(cambios.modalidad !== undefined
          ? { modalidad: cambios.modalidad }
          : {}),
        ...(cambios.estado !== undefined ? { estado: cambios.estado } : {}),
        ...(cambios.nota !== undefined ? { nota: cambios.nota } : {}),
      },
    });

    const f = await this.prisma.leadActividad.findFirst({
      where: { id: actividadId, organizacionId },
      include: {
        lead: { select: { id: true, nombre: true, telefono: true } },
        asignadoUsuario: { select: { id: true, nombre: true, apellido: true } },
      },
    });
    if (!f) throw new Error('Actividad no encontrada tras actualizar');
    return this.mapAgenda(f);
  }

  async existeSolape(
    organizacionId: string,
    asignadoUsuarioId: string,
    inicio: Date,
    fin: Date,
    excluirActividadId?: string,
  ): Promise<boolean> {
    const conflicto = await this.prisma.leadActividad.findFirst({
      where: {
        organizacionId,
        asignadoUsuarioId,
        estado: 'PROGRAMADA',
        ...(excluirActividadId ? { id: { not: excluirActividadId } } : {}),
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
    tipo: string;
    titulo: string;
    programadaEn: Date;
    programadaFin: Date;
    duracionMinutos: number;
    referenciaInmueble: string | null;
    modalidad: string | null;
    estado: string;
    nota: string | null;
    lead: { id: string; nombre: string | null; telefono: string | null };
    asignadoUsuario: {
      id: string;
      nombre: string;
      apellido: string | null;
    } | null;
  }): ActividadAgendaRow {
    return {
      id: f.id,
      leadId: f.leadId,
      leadNombre: f.lead.nombre,
      leadTelefono: f.lead.telefono,
      tipo: f.tipo,
      titulo: f.titulo,
      programadaEn: f.programadaEn,
      programadaFin: f.programadaFin,
      duracionMinutos: f.duracionMinutos,
      referenciaInmueble: f.referenciaInmueble,
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
