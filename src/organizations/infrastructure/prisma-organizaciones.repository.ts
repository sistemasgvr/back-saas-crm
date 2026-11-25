import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type { ReubicacionEstado } from '../../shared/domain/pipeline-inmobiliaria';
import type {
  ActualizarOrganizacionInput,
  OrganizacionesRepository,
} from '../application/ports/organizaciones.repository.port';

@Injectable()
export class PrismaOrganizacionesRepository implements OrganizacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActivaById(id: string) {
    return this.prisma.organizacion.findFirst({ where: { id, estado: 1 } });
  }

  actualizar(
    id: string,
    data: ActualizarOrganizacionInput,
    usuarioEdicion: string,
  ) {
    return this.prisma.organizacion.update({
      where: { id },
      data: { ...data, usuarioEdicion },
    });
  }

  async obtenerPipelineConfig(organizacionId: string) {
    const row = await this.prisma.organizacion.findFirst({
      where: { id: organizacionId, estado: 1 },
      select: { pipelineConfig: true },
    });
    return row?.pipelineConfig ?? null;
  }

  async actualizarPipelineConfig(
    organizacionId: string,
    config: Prisma.InputJsonValue | null,
    usuarioEdicion: string,
    reubicaciones: ReubicacionEstado[] = [],
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.organizacion.update({
        where: { id: organizacionId },
        data: {
          pipelineConfig: config === null ? Prisma.DbNull : config,
          usuarioEdicion,
        },
      });

      let movidos = 0;
      const ahora = new Date();
      for (const { tipoLead, desde, hacia } of reubicaciones) {
        const leads = await tx.lead.findMany({
          where: this.filtroLeadsEnEstado(organizacionId, tipoLead, desde),
          select: { id: true, tipoLead: true },
        });
        if (leads.length === 0) continue;
        const ids = leads.map((l) => l.id);

        await tx.lead.updateMany({
          where: { id: { in: ids } },
          data: {
            estadoGestion: hacia,
            estadoGestionEn: ahora,
            estadoGestionPorUsuarioId: usuarioEdicion,
            usuarioEdicion,
          },
        });
        await tx.leadEstadoHistorial.createMany({
          data: leads.map((l) => ({
            organizacionId,
            leadId: l.id,
            tipoLead: l.tipoLead,
            desde,
            hacia,
            nota: 'Etapa eliminada del pipeline: el lead retrocedió a la etapa anterior.',
            usuarioId: usuarioEdicion,
          })),
        });
        if (desde === 'VISITA_AGENDADA') {
          await tx.leadVisita.updateMany({
            where: { leadId: { in: ids }, estado: 'PROGRAMADA' },
            data: { estado: 'CANCELADA', resultado: 'CANCELADA' },
          });
        }
        movidos += ids.length;
      }
      return movidos;
    });
  }

  async contarLeadsEnEstado(
    organizacionId: string,
    tipoLead: ReubicacionEstado['tipoLead'],
    estadoGestion: string,
  ) {
    return this.prisma.lead.count({
      where: this.filtroLeadsEnEstado(organizacionId, tipoLead, estadoGestion),
    });
  }

  /** Sin tipo definido el lead usa el embudo OTRO. */
  private filtroLeadsEnEstado(
    organizacionId: string,
    tipoLead: ReubicacionEstado['tipoLead'],
    estadoGestion: string,
  ): Prisma.LeadWhereInput {
    return {
      organizacionId,
      estado: 1,
      estadoGestion,
      ...(tipoLead === 'OTRO'
        ? { OR: [{ tipoLead: 'OTRO' }, { tipoLead: null }] }
        : { tipoLead }),
    };
  }
}
