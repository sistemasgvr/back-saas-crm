import type { Prisma } from '@prisma/client';
import { fechaLima } from '../../shared/application/lima-time';
import {
  consumoDelDia,
  limitesDesdeJson,
} from '../domain/consumo-auto-asignacion';
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
export class PrismaLeadAutoAsignacionRepository implements LeadAutoAsignacionRepository {
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
      limitesDiarios: limitesDesdeJson(cfg.limitesDiarios),
      asignadosHoy: consumoDelDia(cfg.consumoDiario, fechaLima()).porUsuario,
      diaConsumo: fechaLima(),
    };
  }

  async actualizarConfig(input: {
    organizacionId: string;
    habilitado: boolean;
    usuarioIds: string[];
    limitesDiarios?: Record<string, number>;
  }): Promise<void> {
    if (!input.usuarioIds.length) {
      await this.prisma.leadAutoAsignacionConfig.updateMany({
        where: { organizacionId: input.organizacionId },
        data: { habilitado: 0 },
      });
      return;
    }
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
        limitesDiarios: input.limitesDiarios ?? {},
        siguienteIndice: 0,
      },
      update: {
        habilitado: input.habilitado ? 1 : 0,
        usuarioPrimeroId,
        usuarioSegundoId,
        usuarioIds: input.usuarioIds as object,
        ...(input.limitesDiarios !== undefined
          ? { limitesDiarios: input.limitesDiarios }
          : {}),
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
  }): Promise<{
    asignadoUsuarioId: string | null;
    fechaLeadEfectiva: Date;
  } | null> {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: input.leadId,
        organizacionId: input.organizacionId,
        estado: 1,
      },
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

  /** Bloqueo por organización: cursor, cupos y asignación se confirman juntos. */
  private async bloquearConfig(
    tx: Prisma.TransactionClient,
    organizacionId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM lead_auto_asignacion_config
      WHERE organizacion_id = ${organizacionId}::uuid FOR UPDATE`;
    return tx.leadAutoAsignacionConfig.findUnique({
      where: { organizacionId },
    });
  }

  private async asignarEnTransaccion(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    leadId: string,
  ): Promise<string | null> {
    const cfg = await this.bloquearConfig(tx, organizacionId);
    if (!cfg || !configHabilitada(cfg)) return null;

    const lead = await tx.lead.findFirst({
      where: { id: leadId, organizacionId, estado: 1, asignadoUsuarioId: null },
      select: { id: true },
    });
    if (!lead) {
      await tx.leadAutoAsignacionQueue.deleteMany({
        where: { organizacionId, leadId },
      });
      return null;
    }

    const usuarioIds = resolverUsuarioIdsRoundRobin(cfg);
    const n = usuarioIds.length;
    const ahora = new Date();
    const consumo = consumoDelDia(cfg.consumoDiario, fechaLima(ahora));
    const limites = limitesDesdeJson(cfg.limitesDiarios);
    const inicio = n ? ((cfg.siguienteIndice % n) + n) % n : 0;
    for (let intento = 0; intento < n; intento++) {
      const indice = (inicio + intento) % n;
      const usuarioId = usuarioIds[indice];
      if (
        limites[usuarioId] !== undefined &&
        (consumo.porUsuario[usuarioId] ?? 0) >= limites[usuarioId]
      )
        continue;
      const miembro = await tx.organizacionUsuario.findFirst({
        where: { organizacionId, usuarioId, estado: 1, usuario: { estado: 1 } },
        select: { id: true },
      });
      if (!miembro) continue;

      const result = await tx.lead.updateMany({
        where: {
          id: leadId,
          organizacionId,
          estado: 1,
          asignadoUsuarioId: null,
        },
        data: {
          asignadoUsuarioId: usuarioId,
          asignadoEn: ahora,
          asignadoPorUsuarioId: null,
          usuarioEdicion: usuarioId,
        },
      });
      if (result.count === 1) {
        consumo.porUsuario[usuarioId] =
          (consumo.porUsuario[usuarioId] ?? 0) + 1;
        await tx.leadAutoAsignacionConfig.update({
          where: { organizacionId },
          data: { siguienteIndice: (indice + 1) % n, consumoDiario: consumo },
        });
      }
      await tx.leadAutoAsignacionQueue.deleteMany({
        where: { organizacionId, leadId },
      });
      return result.count === 1 ? usuarioId : null;
    }

    // Sin cupos: queda libre para gestión manual, sin reparto diferido al día siguiente.
    await tx.leadAutoAsignacionQueue.deleteMany({
      where: { organizacionId, leadId },
    });
    return null;
  }

  async asignarLeadPendiente(
    organizacionId: string,
    leadId: string,
  ): Promise<string | null> {
    return this.prisma.$transaction((tx) =>
      this.asignarEnTransaccion(tx, organizacionId, leadId),
    );
  }

  async procesarCola(organizacionId: string): Promise<void> {
    // Una transacción por lead evita mantener un bloqueo durante toda la cola.
    for (let i = 0; i < 500; i++) {
      const procesado = await this.prisma.$transaction(async (tx) => {
        const cfg = await this.bloquearConfig(tx, organizacionId);
        if (!cfg || !configHabilitada(cfg)) return false;
        const item = await tx.leadAutoAsignacionQueue.findFirst({
          where: { organizacionId },
          orderBy: [
            { fechaLead: 'asc' },
            { fechaEncolado: 'asc' },
            { id: 'asc' },
          ],
          select: { leadId: true },
        });
        if (!item) return false;
        await this.asignarEnTransaccion(tx, organizacionId, item.leadId);
        return true;
      });
      if (!procesado) return;
    }
  }
}
