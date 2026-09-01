import { Inject, Injectable, Logger } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../shared/infrastructure/token-encryption.service';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

/** Nombre de evento Conversions API por estado terminal — Meta no exige un
 * enum fijo para eventos de CRM ("Event names derive from lead status
 * values"), así que estos son los nuestros, en inglés porque así los espera
 * ver un analista mirando Events Manager. */
const EVENTO_CAPI_POR_ESTADO: Record<string, string> = {
  CERRADO_GANADO: 'Won',
  CERRADO_PERDIDO: 'Lost',
  DESCARTADO: 'Disqualified',
};

/**
 * Manda a Meta el resultado final de un lead (ganado/perdido/descartado) vía
 * Conversions API — Conversion Leads, para que optimice la entrega de Lead
 * Ads por calidad real y no solo volumen (PLAN-PIPELINE-INMOBILIARIA.md
 * §20.5 / Oleada C). Se llama fire-and-forget desde
 * ActualizarGestionLeadUseCase — nunca debe bloquear ni hacer fallar un
 * cambio de estado si Meta no responde.
 *
 * No hace nada (silenciosamente) si: el estado no es uno de los 3
 * terminales, la organización no configuró un dataset CAPI, o el lead no
 * tiene id externo de Meta (leads cargados a mano, sin Meta detrás).
 */
@Injectable()
export class EnviarEventoConversionLeadUseCase {
  private readonly logger = new Logger(EnviarEventoConversionLeadUseCase.name);

  constructor(
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leadsGestion: LeadsGestionRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    estadoGestion: string,
    /** Id único y estable para deduplicar en Meta — la fila de historial que originó este cambio. */
    eventoId: string,
  ): Promise<void> {
    const nombreEvento = EVENTO_CAPI_POR_ESTADO[estadoGestion];
    if (!nombreEvento) return;

    try {
      const conexion =
        await this.conexiones.findActivaPorOrganizacion(organizacionId);
      if (!conexion?.capiDatasetId || !conexion.tokenCifrado) return;

      const leadIdMeta = await this.leadsGestion.obtenerIdExternoMeta(
        organizacionId,
        leadId,
      );
      if (!leadIdMeta) return;

      const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
      await this.graph.enviarEventoConversionLead(
        conexion.capiDatasetId,
        accessToken,
        { nombreEvento, fechaEvento: new Date(), eventoId, leadIdMeta },
      );
    } catch (error) {
      // Nunca debe romper el cambio de estado en el CRM por un problema de Meta.
      this.logger.error(
        `No se pudo mandar el evento CAPI ${nombreEvento} del lead ${leadId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
