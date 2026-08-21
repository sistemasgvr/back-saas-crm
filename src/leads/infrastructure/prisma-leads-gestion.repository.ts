import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  LeadParaGestion,
  LeadsGestionRepository,
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
      select: { id: true, asignadoUsuarioId: true },
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

  async actualizarTipo(
    organizacionId: string,
    id: string,
    tipoLead: string,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.lead.updateMany({
      where: { id, organizacionId, estado: 1 },
      data: { tipoLead, usuarioEdicion },
    });
  }
}
