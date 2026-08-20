import { Inject, Injectable } from '@nestjs/common';
import { LEADS_LECTURA_REPOSITORY } from '../ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../ports/leads-lectura.repository.port';
import {
  inicioDiaLimaUtc,
  finDiaLimaUtc,
} from '../../../shared/application/lima-time';

export interface ListarLeadsInput {
  q?: string;
  campanaId?: string;
  anuncioId?: string;
  metaPaginaId?: string;
  metaCuentaId?: string;
  formularioId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class ListarLeadsUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
  ) {}

  execute(organizacionId: string, input: ListarLeadsInput) {
    return this.leads.listar(organizacionId, {
      q: input.q,
      campanaId: input.campanaId,
      anuncioId: input.anuncioId,
      metaPaginaId: input.metaPaginaId,
      metaCuentaId: input.metaCuentaId,
      formularioId: input.formularioId,
      fechaDesde: input.fechaDesde
        ? inicioDiaLimaUtc(input.fechaDesde)
        : undefined,
      fechaHasta: input.fechaHasta
        ? finDiaLimaUtc(input.fechaHasta)
        : undefined,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
