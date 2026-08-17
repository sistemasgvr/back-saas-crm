import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LEADS_LECTURA_REPOSITORY } from '../ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../ports/leads-lectura.repository.port';

@Injectable()
export class ObtenerLeadUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY) private readonly leads: LeadsLecturaRepository,
  ) {}

  async execute(organizacionId: string, id: string) {
    const lead = await this.leads.obtenerPorId(organizacionId, id);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }
    return lead;
  }
}
