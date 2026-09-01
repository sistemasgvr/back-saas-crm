import { Inject, Injectable } from '@nestjs/common';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { PageSinConexionError } from '../errors/page-sin-conexion.error';
import { IngestarLeadGraphUseCase } from './ingestar-lead-graph.use-case';

export interface ResultadoProcesarLead {
  procesado: boolean;
  motivo?: string;
  leadId?: string;
  organizacionId?: string;
  creado?: boolean;
}

@Injectable()
export class ProcesarLeadEntranteUseCase {
  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly ingestar: IngestarLeadGraphUseCase,
  ) {}

  async execute(
    pageId: string,
    leadgenId: string,
  ): Promise<ResultadoProcesarLead> {
    const pagina = await this.paginas.findActivaPorPageId(pageId);
    if (
      !pagina ||
      (!pagina.tokenPaginaCifrado && !pagina.conexionTokenCifrado)
    ) {
      throw new PageSinConexionError(pageId);
    }

    const userToken = pagina.conexionTokenCifrado
      ? this.tokenEncryption.decrypt(pagina.conexionTokenCifrado)
      : null;

    let pageToken: string | null = pagina.tokenPaginaCifrado
      ? this.tokenEncryption.decrypt(pagina.tokenPaginaCifrado)
      : null;

    if (!pageToken && userToken) {
      pageToken = await this.graph.obtenerAccessTokenPagina(
        pagina.pageId,
        userToken,
      );
    }

    if (!pageToken) {
      throw new PageSinConexionError(pageId);
    }

    // Puede lanzar BadGatewayException — el controller ya no la deja escapar
    // como 5xx (siempre ACK 200 una vez validada la firma), la captura y
    // loguea; un fallo puntual acá se recupera con el backfill manual, no
    // con reintento automático de Meta.
    const lead = await this.graph.obtenerLead(leadgenId, pageToken);

    // User token preferido para enriquecer nombres (ads_read); Page token como fallback.
    const tokenEnriquecimiento = userToken ?? pageToken;

    const resultado = await this.ingestar.execute(
      pagina.organizacionId,
      pagina.id,
      tokenEnriquecimiento,
      lead,
    );

    return {
      procesado: true,
      leadId: resultado.leadId,
      organizacionId: pagina.organizacionId,
      creado: resultado.creado,
    };
  }
}
