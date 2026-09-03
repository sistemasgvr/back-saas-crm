import { Inject, Injectable } from '@nestjs/common';
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
      return { asignadoUsuarioId: null, fueAutoAsignado: false };
    }

    await this.repo.encolarLead({
      organizacionId,
      leadId,
      fechaLead: lead.fechaLeadEfectiva,
    });

    await this.repo.procesarCola(organizacionId);

    const despues = await this.repo.obtenerLeadParaAutoAsignacion({
      organizacionId,
      leadId,
    });

    if (!despues?.asignadoUsuarioId) {
      return { asignadoUsuarioId: null, fueAutoAsignado: false };
    }

    return { asignadoUsuarioId: despues.asignadoUsuarioId, fueAutoAsignado: true };
  }
}

