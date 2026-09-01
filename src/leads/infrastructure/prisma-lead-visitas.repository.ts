import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  LeadVisitasRepository,
  VisitaAgendaRow,
  VisitaLeadRow,
} from '../application/ports/lead-visitas.repository.port';

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
      },
      orderBy: { programadaEn: 'asc' },
    });

    return filas.map((f) => ({
      id: f.id,
      leadId: f.leadId,
      leadNombre: f.lead.nombre,
      leadTelefono: f.lead.telefono,
      programadaEn: f.programadaEn,
      referenciaInmueble: f.referenciaInmueble,
      modalidad: f.modalidad,
      estado: f.estado,
      asignado: f.asignadoUsuario
        ? {
            id: f.asignadoUsuario.id,
            nombre: [f.asignadoUsuario.nombre, f.asignadoUsuario.apellido]
              .filter(Boolean)
              .join(' '),
          }
        : null,
    }));
  }

  async listarPorLead(
    organizacionId: string,
    leadId: string,
  ): Promise<VisitaLeadRow[]> {
    const filas = await this.prisma.leadVisita.findMany({
      where: { organizacionId, leadId },
      orderBy: { programadaEn: 'desc' },
    });

    return filas.map((f) => ({
      id: f.id,
      programadaEn: f.programadaEn,
      referenciaInmueble: f.referenciaInmueble,
      modalidad: f.modalidad,
      estado: f.estado,
      resultado: f.resultado,
      nota: f.nota,
      feedback: f.feedback,
      fechaCreacion: f.fechaCreacion,
    }));
  }
}
