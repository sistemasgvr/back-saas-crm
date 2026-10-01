import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  LEAD_AUTO_ASIGNACION_REPOSITORY,
  type LeadAutoAsignacionRepository,
} from '../ports/lead-auto-asignacion.repository.port';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

@Injectable()
export class ActualizarAutoAsignacionConfigUseCase {
  constructor(
    @Inject(LEAD_AUTO_ASIGNACION_REPOSITORY)
    private readonly repo: LeadAutoAsignacionRepository,
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
  ) {}

  async execute(
    organizacionId: string,
    input: {
      habilitado: boolean;
      usuarioIds: string[];
      limitesDiarios?: Record<string, number>;
    },
  ): Promise<void> {
    if (input.habilitado && input.usuarioIds.length < 1) {
      throw new BadRequestException(
        'Se requiere al menos 1 usuario para habilitar la asignación automática',
      );
    }

    if (
      input.limitesDiarios !== undefined &&
      (!input.limitesDiarios ||
        typeof input.limitesDiarios !== 'object' ||
        Array.isArray(input.limitesDiarios))
    ) {
      throw new BadRequestException('Los límites diarios deben ser un objeto');
    }
    for (const [usuarioId, limite] of Object.entries(
      input.limitesDiarios ?? {},
    )) {
      if (
        !input.usuarioIds.includes(usuarioId) ||
        !Number.isSafeInteger(limite) ||
        limite < 1
      ) {
        throw new BadRequestException(
          'Cada límite diario debe ser un entero positivo de un usuario seleccionado',
        );
      }
    }

    // Todos los usuarios del round-robin deben ser distintos.
    if (new Set(input.usuarioIds).size !== input.usuarioIds.length) {
      throw new BadRequestException(
        'Los usuarios del round-robin deben ser distintos',
      );
    }

    // Si habilitamos, todos deben ser miembros activos.
    if (input.habilitado) {
      const miembros = await Promise.all(
        input.usuarioIds.map((usuarioId) =>
          this.leads.esMiembroActivo(organizacionId, usuarioId),
        ),
      );

      if (miembros.some((esMiembro) => !esMiembro)) {
        throw new BadRequestException(
          'Todos los usuarios deben ser miembros activos de la organización',
        );
      }
    }

    await this.repo.actualizarConfig({
      organizacionId,
      habilitado: input.habilitado,
      usuarioIds: input.usuarioIds,
      ...(input.limitesDiarios !== undefined ? { limitesDiarios: input.limitesDiarios } : {}),
    });
  }
}
