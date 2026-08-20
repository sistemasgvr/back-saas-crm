import { Inject, Injectable } from '@nestjs/common';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type {
  MetaGraphClient,
  MetaLeadGraph,
} from '../../../connections/application/ports/meta-graph-client.port';
import { CAMPANAS_REPOSITORY } from '../../../campaigns/application/ports/campanas.repository.port';
import type { CampanasRepository } from '../../../campaigns/application/ports/campanas.repository.port';
import { CONJUNTOS_ANUNCIOS_REPOSITORY } from '../../../adsets/application/ports/conjuntos-anuncios.repository.port';
import type { ConjuntosAnunciosRepository } from '../../../adsets/application/ports/conjuntos-anuncios.repository.port';
import { ANUNCIOS_REPOSITORY } from '../../../ads/application/ports/anuncios.repository.port';
import type { AnunciosRepository } from '../../../ads/application/ports/anuncios.repository.port';
import { LEADS_REPOSITORY } from '../ports/leads.repository.port';
import type { LeadsRepository } from '../ports/leads.repository.port';
import { extraerContactoLead } from '../extraer-contacto-lead';

export interface ResultadoIngestarLead {
  leadId: string;
  creado: boolean;
}

/** Lógica de ingest compartida entre el webhook (ProcesarLeadEntranteUseCase) y el
 * backfill (BackfillLeadsFormularioUseCase) — PLAN-FASE-14 §4.3: "misma lógica" para
 * que un reimport nunca duplique lo que el webhook ya procesó. */
@Injectable()
export class IngestarLeadGraphUseCase {
  constructor(
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    @Inject(CAMPANAS_REPOSITORY) private readonly campanas: CampanasRepository,
    @Inject(CONJUNTOS_ANUNCIOS_REPOSITORY)
    private readonly conjuntos: ConjuntosAnunciosRepository,
    @Inject(ANUNCIOS_REPOSITORY) private readonly anuncios: AnunciosRepository,
    @Inject(LEADS_REPOSITORY) private readonly leads: LeadsRepository,
  ) {}

  async execute(
    organizacionId: string,
    metaPaginaId: string,
    accessToken: string,
    lead: MetaLeadGraph,
  ): Promise<ResultadoIngestarLead> {
    let campanaId: string | undefined;
    let conjuntoAnuncioId: string | undefined;
    let anuncioId: string | undefined;

    if (lead.campaignId) {
      const nombreCampana =
        (await this.graph.obtenerNombreRecurso(lead.campaignId, accessToken)) ??
        lead.campaignId;
      const campana = await this.campanas.upsertPorMetaId({
        organizacionId,
        metaCampanaId: lead.campaignId,
        nombre: nombreCampana,
      });
      campanaId = campana.id;
    }

    if (lead.adsetId && campanaId) {
      const nombreConjunto =
        (await this.graph.obtenerNombreRecurso(lead.adsetId, accessToken)) ??
        lead.adsetId;
      const conjunto = await this.conjuntos.upsertPorMetaId({
        organizacionId,
        campanaId,
        metaConjuntoId: lead.adsetId,
        nombre: nombreConjunto,
      });
      conjuntoAnuncioId = conjunto.id;
    }

    if (lead.adId && conjuntoAnuncioId) {
      const nombreAnuncio =
        (await this.graph.obtenerNombreRecurso(lead.adId, accessToken)) ??
        lead.adId;
      const anuncio = await this.anuncios.upsertPorMetaId({
        organizacionId,
        conjuntoAnuncioId,
        metaAnuncioId: lead.adId,
        nombre: nombreAnuncio,
      });
      anuncioId = anuncio.id;
    }

    const contacto = extraerContactoLead(lead.fieldData);

    const resultado = await this.leads.upsertPorIdExterno({
      organizacionId,
      metaPaginaId,
      campanaId,
      conjuntoAnuncioId,
      anuncioId,
      formularioId: lead.formId,
      idExterno: lead.leadgenId,
      nombre: contacto.nombre,
      email: contacto.email,
      telefono: contacto.telefono,
      datosCrudos: lead.raw,
      fechaLead: lead.createdTime,
    });

    return { leadId: resultado.id, creado: resultado.creado };
  }
}
