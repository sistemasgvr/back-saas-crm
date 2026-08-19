import { Inject, Injectable } from '@nestjs/common';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { CAMPANAS_REPOSITORY } from '../../../campaigns/application/ports/campanas.repository.port';
import type { CampanasRepository } from '../../../campaigns/application/ports/campanas.repository.port';
import { CONJUNTOS_ANUNCIOS_REPOSITORY } from '../../../adsets/application/ports/conjuntos-anuncios.repository.port';
import type { ConjuntosAnunciosRepository } from '../../../adsets/application/ports/conjuntos-anuncios.repository.port';
import { ANUNCIOS_REPOSITORY } from '../../../ads/application/ports/anuncios.repository.port';
import type { AnunciosRepository } from '../../../ads/application/ports/anuncios.repository.port';
import { LEADS_REPOSITORY } from '../ports/leads.repository.port';
import type { LeadsRepository } from '../ports/leads.repository.port';
import { PageSinConexionError } from '../errors/page-sin-conexion.error';
import { extraerContactoLead } from '../extraer-contacto-lead';

export interface ResultadoProcesarLead {
  procesado: boolean;
  motivo?: string;
  leadId?: string;
  organizacionId?: string;
}

@Injectable()
export class ProcesarLeadEntranteUseCase {
  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    @Inject(CAMPANAS_REPOSITORY) private readonly campanas: CampanasRepository,
    @Inject(CONJUNTOS_ANUNCIOS_REPOSITORY)
    private readonly conjuntos: ConjuntosAnunciosRepository,
    @Inject(ANUNCIOS_REPOSITORY) private readonly anuncios: AnunciosRepository,
    @Inject(LEADS_REPOSITORY) private readonly leads: LeadsRepository,
  ) {}

  async execute(
    pageId: string,
    leadgenId: string,
  ): Promise<ResultadoProcesarLead> {
    const pagina = await this.paginas.findActivaPorPageId(pageId);
    if (!pagina?.conexionTokenCifrado) {
      throw new PageSinConexionError(pageId);
    }

    const accessToken = this.tokenEncryption.decrypt(
      pagina.conexionTokenCifrado,
    );
    // Puede lanzar BadGatewayException — el caller (controller) responde 5xx para que Meta reintente.
    const lead = await this.graph.obtenerLead(leadgenId, accessToken);

    let campanaId: string | undefined;
    let conjuntoAnuncioId: string | undefined;
    let anuncioId: string | undefined;

    if (lead.campaignId) {
      const nombreCampana =
        (await this.graph.obtenerNombreRecurso(lead.campaignId, accessToken)) ??
        lead.campaignId;
      // meta_cuenta_publicitaria_id queda NULL acá — se completa con el sync manual de la
      // cuenta (Fase 13.3, PLAN-FASE-13-META-MULTI.md §3.4) si la campaña ya existía se conserva.
      const campana = await this.campanas.upsertPorMetaId({
        organizacionId: pagina.organizacionId,
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
        organizacionId: pagina.organizacionId,
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
        organizacionId: pagina.organizacionId,
        conjuntoAnuncioId,
        metaAnuncioId: lead.adId,
        nombre: nombreAnuncio,
      });
      anuncioId = anuncio.id;
    }

    const contacto = extraerContactoLead(lead.fieldData);

    const resultado = await this.leads.upsertPorIdExterno({
      organizacionId: pagina.organizacionId,
      metaPaginaId: pagina.id,
      campanaId,
      conjuntoAnuncioId,
      anuncioId,
      formularioId: lead.formId,
      idExterno: leadgenId,
      nombre: contacto.nombre,
      email: contacto.email,
      telefono: contacto.telefono,
      datosCrudos: lead.raw,
      fechaLead: lead.createdTime,
    });

    return {
      procesado: true,
      leadId: resultado.id,
      organizacionId: pagina.organizacionId,
    };
  }
}
