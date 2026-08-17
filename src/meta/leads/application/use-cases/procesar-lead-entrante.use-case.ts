import { Inject, Injectable, Logger } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { CAMPANAS_REPOSITORY } from '../../../campaigns/application/ports/campanas.repository.port';
import type { CampanasRepository } from '../../../campaigns/application/ports/campanas.repository.port';
import { CONJUNTOS_ANUNCIOS_REPOSITORY } from '../../../adsets/application/ports/conjuntos-anuncios.repository.port';
import type { ConjuntosAnunciosRepository } from '../../../adsets/application/ports/conjuntos-anuncios.repository.port';
import { ANUNCIOS_REPOSITORY } from '../../../ads/application/ports/anuncios.repository.port';
import type { AnunciosRepository } from '../../../ads/application/ports/anuncios.repository.port';
import { LEADS_REPOSITORY } from '../ports/leads.repository.port';
import type { LeadsRepository } from '../ports/leads.repository.port';
import { extraerContactoLead } from '../extraer-contacto-lead';

export interface ResultadoProcesarLead {
  procesado: boolean;
  motivo?: string;
  leadId?: string;
}

@Injectable()
export class ProcesarLeadEntranteUseCase {
  private readonly logger = new Logger(ProcesarLeadEntranteUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY) private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    @Inject(CAMPANAS_REPOSITORY) private readonly campanas: CampanasRepository,
    @Inject(CONJUNTOS_ANUNCIOS_REPOSITORY) private readonly conjuntos: ConjuntosAnunciosRepository,
    @Inject(ANUNCIOS_REPOSITORY) private readonly anuncios: AnunciosRepository,
    @Inject(LEADS_REPOSITORY) private readonly leads: LeadsRepository,
  ) {}

  async execute(pageId: string, leadgenId: string): Promise<ResultadoProcesarLead> {
    const conexion = await this.conexiones.findActivaPorPageId(pageId);
    if (!conexion?.tokenCifrado) {
      this.logger.warn(`Webhook de leadgen para page_id sin conexión activa: ${pageId}`);
      return { procesado: false, motivo: 'page_id sin conexión activa' };
    }

    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    // Puede lanzar BadGatewayException — el caller (controller) responde 5xx para que Meta reintente.
    const lead = await this.graph.obtenerLead(leadgenId, accessToken);

    let campanaId: string | undefined;
    let conjuntoAnuncioId: string | undefined;
    let anuncioId: string | undefined;

    if (lead.campaignId) {
      const campana = await this.campanas.upsertPorMetaId({
        organizacionId: conexion.organizacionId,
        metaCampanaId: lead.campaignId,
        nombre: lead.campaignId,
      });
      campanaId = campana.id;
    }

    if (lead.adsetId && campanaId) {
      const conjunto = await this.conjuntos.upsertPorMetaId({
        organizacionId: conexion.organizacionId,
        campanaId,
        metaConjuntoId: lead.adsetId,
        nombre: lead.adsetId,
      });
      conjuntoAnuncioId = conjunto.id;
    }

    if (lead.adId && conjuntoAnuncioId) {
      const anuncio = await this.anuncios.upsertPorMetaId({
        organizacionId: conexion.organizacionId,
        conjuntoAnuncioId,
        metaAnuncioId: lead.adId,
        nombre: lead.adId,
      });
      anuncioId = anuncio.id;
    }

    const contacto = extraerContactoLead(lead.fieldData);

    const resultado = await this.leads.upsertPorIdExterno({
      organizacionId: conexion.organizacionId,
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

    return { procesado: true, leadId: resultado.id };
  }
}
