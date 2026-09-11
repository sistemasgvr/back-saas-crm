import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  LeadAutoAsignacionConfig,
  LeadAutoAsignacionRepository,
} from '../application/ports/lead-auto-asignacion.repository.port';
import { resolverUsuarioIdsRoundRobin } from '../domain/resolver-usuario-ids-round-robin';

type ConfigRow = {
  habilitado: number;
  usuarioPrimeroId: string;
  usuarioSegundoId: string;
  usuarioIds: unknown;
  siguienteIndice: number;
};

function configHabilitada(cfg: Pick<ConfigRow, 'habilitado'>): boolean {
  return Number(cfg.habilitado) === 1;
}

@Injectable()
export class PrismaLeadAutoAsignacionRepository
  implements LeadAutoAsignacionRepository
{
  private readonly logger = new Logger(PrismaLeadAutoAsignacionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async obtenerConfig(
    organizacionId: string,
  ): Promise<LeadAutoAsignacionConfig | null> {
    const cfg = await this.prisma.leadAutoAsignacionConfig.findUnique({
      where: { organizacionId },
    });

    if (!cfg) return null;

    return {
      habilitado: configHabilitada(cfg),
      usuarioIds: resolverUsuarioIdsRoundRobin(cfg),
      siguienteIndice: cfg.siguienteIndice,
    };
  }

  async actualizarConfig(input: {
    organizacionId: string;
    habilitado: boolean;
    usuarioIds: string[];
  }): Promise<void> {
    const usuarioPrimeroId = input.usuarioIds[0];
    const usuarioSegundoId = input.usuarioIds[1] ?? input.usuarioIds[0];

    await this.prisma.leadAutoAsignacionConfig.upsert({
      where: { organizacionId: input.organizacionId },
      create: {
        organizacionId: input.organizacionId,
        habilitado: input.habilitado ? 1 : 0,
        usuarioPrimeroId,
        usuarioSegundoId,
        usuarioIds: input.usuarioIds as object,
        siguienteIndice: 0,
      },
      update: {
        habilitado: input.habilitado ? 1 : 0,
        usuarioPrimeroId,
        usuarioSegundoId,
        usuarioIds: input.usuarioIds as object,
        // Si el usuario ajusta la configuración, reiniciamos la secuencia.
        siguienteIndice: 0,
      },
    });
  }

  async encolarLead(input: {
    organizacionId: string;
    leadId: string;
    fechaLead: Date;
  }): Promise<void> {
    await this.prisma.leadAutoAsignacionQueue.upsert({
      where: {
        organizacionId_leadId: {
          organizacionId: input.organizacionId,
          leadId: input.leadId,
        },
      },
      create: {
        organizacionId: input.organizacionId,
        leadId: input.leadId,
        fechaLead: input.fechaLead,
      },
      update: { fechaLead: input.fechaLead },
    });
  }

  async obtenerLeadParaAutoAsignacion(input: {
    organizacionId: string;
    leadId: string;
  }): Promise<{ asignadoUsuarioId: string | null; fechaLeadEfectiva: Date } | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: input.leadId, organizacionId: input.organizacionId, estado: 1 },
      select: {
        asignadoUsuarioId: true,
        fechaLead: true,
        fechaCreacion: true,
      },
    });

    if (!lead) return null;
    return {
      asignadoUsuarioId: lead.asignadoUsuarioId,
      fechaLeadEfectiva: lead.fechaLead ?? lead.fechaCreacion,
    };
  }

  async asignarLeadPendiente(
    organizacionId: string,
    leadId: string,
  ): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const cfg = await tx.leadAutoAsignacionConfig.findUnique({
        where: { organizacionId },
      });
      if (!cfg || !configHabilitada(cfg)) return null;

      const lead = await tx.lead.findFirst({
        where: {
          id: leadId,
          organizacionId,
          estado: 1,
          asignadoUsuarioId: null,
        },
        select: { id: true },
      });
      if (!lead) return null;

      const usuarioIds = resolverUsuarioIdsRoundRobin(cfg);
      const N = usuarioIds.length;
      if (N === 0) {
        this.logger.warn(
          `Auto-asignación org=${organizacionId}: pool vacío, no se asigna lead=${leadId}`,
        );
        return null;
      }

      const indiceActual =
        ((Number(cfg.siguienteIndice) % N) + N) % N;
      const usuarioDestinoId = usuarioIds[indiceActual];
      if (!usuarioDestinoId) {
        this.logger.warn(
          `Auto-asignación org=${organizacionId}: índice ${indiceActual} sin usuario`,
        );
        return null;
      }

      const usuarioOk = await tx.usuario.findFirst({
        where: { id: usuarioDestinoId, estado: 1 },
        select: { id: true },
      });
      if (!usuarioOk) {
        this.logger.warn(
          `Auto-asignación org=${organizacionId}: usuario destino ${usuarioDestinoId} inactivo/ausente`,
        );
        // Avanzar cursor para no quedar atascados en el mismo destino.
        await tx.leadAutoAsignacionConfig.update({
          where: { organizacionId },
          data: { siguienteIndice: (indiceActual + 1) % N },
        });
        return null;
      }

      const siguienteIndice = (indiceActual + 1) % N;
      await tx.leadAutoAsignacionConfig.update({
        where: { organizacionId },
        data: { siguienteIndice },
      });

      const result = await tx.lead.updateMany({
        where: {
          id: leadId,
          organizacionId,
          estado: 1,
          asignadoUsuarioId: null,
        },
        data: {
          asignadoUsuarioId: usuarioDestinoId,
          asignadoEn: new Date(),
          asignadoPorUsuarioId: null,
          usuarioEdicion: usuarioDestinoId,
        },
      });

      await tx.leadAutoAsignacionQueue.deleteMany({
        where: { organizacionId, leadId },
      });

      if (result.count !== 1) {
        // Alguien lo tomó en paralelo: revertir cursor.
        await tx.leadAutoAsignacionConfig.update({
          where: { organizacionId },
          data: { siguienteIndice: indiceActual },
        });
        return null;
      }

      return usuarioDestinoId;
    });
  }

  async procesarCola(organizacionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const cfg = await tx.leadAutoAsignacionConfig.findUnique({
        where: { organizacionId },
      });
      if (!cfg || !configHabilitada(cfg)) return;

      for (let i = 0; i < 500; i += 1) {
        const siguienteItem = await tx.leadAutoAsignacionQueue.findFirst({
          where: { organizacionId },
          orderBy: [{ fechaLead: 'asc' }, { fechaEncolado: 'asc' }],
          select: { id: true, leadId: true },
        });

        if (!siguienteItem) return;

        const cfgActual = await tx.leadAutoAsignacionConfig.findUnique({
          where: { organizacionId },
        });
        if (!cfgActual || !configHabilitada(cfgActual)) return;

        const usuarioIds = resolverUsuarioIdsRoundRobin(cfgActual);
        const N = usuarioIds.length;
        if (N === 0) {
          this.logger.warn(
            `Auto-asignación org=${organizacionId}: pool vacío al drenar cola`,
          );
          return;
        }

        const indiceActual =
          ((Number(cfgActual.siguienteIndice) % N) + N) % N;
        const usuarioDestinoId = usuarioIds[indiceActual];
        if (!usuarioDestinoId) {
          await tx.leadAutoAsignacionQueue.delete({
            where: { id: siguienteItem.id },
          });
          continue;
        }

        const usuarioOk = await tx.usuario.findFirst({
          where: { id: usuarioDestinoId, estado: 1 },
          select: { id: true },
        });
        if (!usuarioOk) {
          // Saltar destino inválido y reintentar el mismo lead con el siguiente.
          await tx.leadAutoAsignacionConfig.update({
            where: { organizacionId },
            data: { siguienteIndice: (indiceActual + 1) % N },
          });
          continue;
        }

        const siguienteIndice = (indiceActual + 1) % N;
        await tx.leadAutoAsignacionConfig.update({
          where: { organizacionId },
          data: { siguienteIndice },
        });

        const result = await tx.lead.updateMany({
          where: {
            id: siguienteItem.leadId,
            organizacionId,
            estado: 1,
            asignadoUsuarioId: null,
          },
          data: {
            asignadoUsuarioId: usuarioDestinoId,
            asignadoEn: new Date(),
            asignadoPorUsuarioId: null,
            usuarioEdicion: usuarioDestinoId,
          },
        });

        if (result.count === 1) {
          await tx.leadAutoAsignacionQueue.delete({
            where: { id: siguienteItem.id },
          });
        } else {
          // Lead ya no libre (tomado/borrado): revertir cursor y sacar de cola.
          await tx.leadAutoAsignacionConfig.update({
            where: { organizacionId },
            data: { siguienteIndice: indiceActual },
          });
          await tx.leadAutoAsignacionQueue.delete({
            where: { id: siguienteItem.id },
          });
        }
      }
    });
  }
}
