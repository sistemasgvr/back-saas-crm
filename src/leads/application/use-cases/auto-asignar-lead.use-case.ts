import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  LeadAutoAsignacionRepository,
} from '../ports/lead-auto-asignacion.repository.port';
import {
  LEAD_AUTO_ASIGNACION_REPOSITORY,
} from '../ports/lead-auto-asignacion.repository.port';

export interface AutoAsignarLeadResultado {
  asignadoUsuarioId: string | null;
  fueAutoAsignado: boolean;
}

@Injectable()
export class AutoAsignarLeadUseCase {
  private readonly logger = new Logger(AutoAsignarLeadUseCase.name);

  constructor(
    @Inject(LEAD_AUTO_ASIGNACION_REPOSITORY)
    private readonly repo: LeadAutoAsignacionRepository,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
  ): Promise<AutoAsignarLeadResultado> {
    const lead = await this.repo.obtenerLeadParaAutoAsignacion({
      organizacionId,
      leadId,
    });
    if (!lead) {
      return { asignadoUsuarioId: null, fueAutoAsignado: false };
    }

    // Si alguien ya lo asignó (tomar/asignar manual), no hacemos nada.
    if (lead.asignadoUsuarioId) {
      return { asignadoUsuarioId: lead.asignadoUsuarioId, fueAutoAsignado: false };
    }

    const cfg = await this.repo.obtenerConfig(organizacionId);
    if (!cfg?.habilitado) {
      this.logger.debug(
        `Auto-asignación OFF org=${organizacionId} lead=${leadId}`,
      );
      return { asignadoUsuarioId: null, fueAutoAsignado: false };
    }

    if (!cfg.usuarioIds.length) {
      this.logger.warn(
        `Auto-asignación ON pero pool vacío org=${organizacionId} lead=${leadId}`,
      );
      return { asignadoUsuarioId: null, fueAutoAsignado: false };
    }

    await this.repo.encolarLead({
      organizacionId,
      leadId,
      fechaLead: lead.fechaLeadEfectiva,
    });

    // Asignación directa del lead (no depende de drenar items viejos de la cola).
    const destino = await this.repo.asignarLeadPendiente(organizacionId, leadId);

    // Drenar restos (otros leads encolados) sin bloquear el resultado de este.
    try {
      await this.repo.procesarCola(organizacionId);
    } catch (error: unknown) {
      this.logger.error(
        `Error drenando cola auto-asignación org=${organizacionId}`,
        error instanceof Error ? error.stack : error,
      );
    }

    if (destino) {
      return { asignadoUsuarioId: destino, fueAutoAsignado: true };
    }

    const despues = await this.repo.obtenerLeadParaAutoAsignacion({
      organizacionId,
      leadId,
    });

    if (!despues?.asignadoUsuarioId) {
      this.logger.warn(
        `Lead ${leadId} quedó sin asignar tras auto-asignación (org=${organizacionId}, pool=${cfg.usuarioIds.length})`,
      );
      return { asignadoUsuarioId: null, fueAutoAsignado: false };
    }

    return { asignadoUsuarioId: despues.asignadoUsuarioId, fueAutoAsignado: true };
  }
}
