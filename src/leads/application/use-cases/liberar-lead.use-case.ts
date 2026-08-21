import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

/** PROPIETARIO/ADMINISTRADOR devuelven un lead al pool sin asignar. */
@Injectable()
export class LiberarLeadUseCase {
  constructor(
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
  ) {}

  async execute(organizacionId: string, leadId: string): Promise<void> {
    const lead = await this.leads.buscarParaGestion(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }
    await this.leads.liberar(organizacionId, leadId);
  }
}
