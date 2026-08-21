import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

/** Autoasignación: cualquier miembro de la org puede tomar un lead libre del
 * pool. Race-safe — PLAN-GESTION-LEADS-WHATSAPP.md §3/§9. */
@Injectable()
export class TomarLeadUseCase {
  constructor(
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    usuarioId: string,
  ): Promise<void> {
    const lead = await this.leads.buscarParaGestion(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    const tomado = await this.leads.tomar(organizacionId, leadId, usuarioId);
    if (!tomado) {
      throw new ConflictException(
        'Este lead ya fue tomado por otro usuario — actualiza la lista.',
      );
    }
  }
}
