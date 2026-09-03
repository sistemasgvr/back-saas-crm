import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  LEAD_AUTO_ASIGNACION_REPOSITORY,
  type LeadAutoAsignacionRepository,
} from '../ports/lead-auto-asignacion.repository.port';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';
import type { AutoAsignacionConfigDto } from './obtener-auto-asignacion-config.use-case';

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
    },
  ): Promise<void> {
    if (input.usuarioIds.length < 2) {
      throw new BadRequestException(
        'Se requiere al menos 2 usuarios para el round-robin',
      );
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
    });
  }
}

