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
    if (!pagina?.conexionTokenCifrado) {
      throw new PageSinConexionError(pageId);
    }

    const accessToken = this.tokenEncryption.decrypt(
      pagina.conexionTokenCifrado,
    );
    // Puede lanzar BadGatewayException — el caller (controller) responde 5xx para que Meta reintente.
    const lead = await this.graph.obtenerLead(leadgenId, accessToken);

    const resultado = await this.ingestar.execute(
      pagina.organizacionId,
      pagina.id,
      accessToken,
      lead,
    );

    return {
      procesado: true,
      leadId: resultado.leadId,
      organizacionId: pagina.organizacionId,
    };
  }
}
