import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  LeadAutoAsignacionConfig,
  LeadAutoAsignacionRepository,
} from '../application/ports/lead-auto-asignacion.repository.port';

@Injectable()
export class PrismaLeadAutoAsignacionRepository
  implements LeadAutoAsignacionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async obtenerConfig(
    organizacionId: string,
  ): Promise<LeadAutoAsignacionConfig | null> {
    const cfg = await this.prisma.leadAutoAsignacionConfig.findUnique({
      where: { organizacionId },
    });

    if (!cfg) return null;
    const usuarioIdsDesdeJson = cfg.usuarioIds as unknown as string[] | null;
    const usuarioIdsJsonValidos = Array.isArray(usuarioIdsDesdeJson)
      ? usuarioIdsDesdeJson.filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    // Compatibilidad: si `usuarioIds` está vacío, seguimos usando los 2 IDs
    // antiguos (y viceversa). La migración nueva intenta backfillar esto.
    const usuarioIds =
      usuarioIdsJsonValidos.length >= 2
        ? usuarioIdsJsonValidos
        : [cfg.usuarioPrimeroId, cfg.usuarioSegundoId];

    return {
      habilitado: cfg.habilitado === 1,
      usuarioIds,
      siguienteIndice: cfg.siguienteIndice,
    };
  }

  async actualizarConfig(input: {
    organizacionId: string;
    habilitado: boolean;
    usuarioIds: string[];
  }): Promise<void> {
    const usuarioPrimeroId = input.usuarioIds[0];
    const usuarioSegundoId = input.usuarioIds[1];

    await this.prisma.leadAutoAsignacionConfig.upsert({
      where: { organizacionId: input.organizacionId },
      create: {
        organizacionId: input.organizacionId,
        habilitado: input.habilitado ? 1 : 0,
        usuarioPrimeroId,
        usuarioSegundoId,
        usuarioIds: input.usuarioIds as any,
        siguienteIndice: 0,
      },
      update: {
        habilitado: input.habilitado ? 1 : 0,
        usuarioPrimeroId,
        usuarioSegundoId,
        usuarioIds: input.usuarioIds as any,
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
    // Dedup: un lead solo puede estar una vez en la cola.
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

  async procesarCola(organizacionId: string): Promise<void> {
    // Nota: esta lógica usa round-robin “cursor” por tenant.
    // Para evitar que dos ejecuciones asignen a la vez con el mismo cursor,
    // se fuerza a “bloquear” el cursor haciendo un update del siguienteIndice
    // dentro de la misma transacción.
    await this.prisma.$transaction(async (tx) => {
      const cfg = await tx.leadAutoAsignacionConfig.findUnique({
        where: { organizacionId },
      });
      if (!cfg || cfg.habilitado !== 1) return;

      // Evita loops infinitos en casos patológicos.
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
        if (!cfgActual || cfgActual.habilitado !== 1) return;

        const usuarioIdsDesdeJson = cfgActual.usuarioIds as unknown as string[] | null;
        const usuarioIdsJsonValidos = Array.isArray(usuarioIdsDesdeJson)
          ? usuarioIdsDesdeJson.filter(
              (id) => typeof id === 'string' && id.length > 0,
            )
          : [];
        const usuarioIds =
          usuarioIdsJsonValidos.length >= 2
            ? usuarioIdsJsonValidos
            : [cfgActual.usuarioPrimeroId, cfgActual.usuarioSegundoId];

        const N = usuarioIds.length;
        if (N === 0) return;

        const indiceActual = ((cfgActual.siguienteIndice % N) + N) % N;
        const usuarioDestinoId = usuarioIds[indiceActual]!;
        const siguienteIndice = (indiceActual + 1) % N;

        // Lock cursor por tenant
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
            // Audit: “usuarioEdicion” queda con el usuario que recibe el lead.
            usuarioEdicion: usuarioDestinoId,
          },
        });

        // Se asignó (1) o no (0) dependiendo de si alguien tomó el lead manualmente.
        if (result.count === 1) {
          // Mantener el cursor avanzado.
          await tx.leadAutoAsignacionQueue.delete({
            where: { id: siguienteItem.id },
          });
        } else {
          // Revertir cursor para que el siguiente lead vaya al mismo destino.
          await tx.leadAutoAsignacionConfig.update({
            where: { organizacionId },
            data: { siguienteIndice: indiceActual },
          });
          // Descartar el item de la cola (ya no es “sin asignar”).
          await tx.leadAutoAsignacionQueue.delete({
            where: { id: siguienteItem.id },
          });
        }
      }
    });
  }
}

