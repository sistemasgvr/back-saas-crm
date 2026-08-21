import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_PAGINAS_REPOSITORY } from '../../../pages/application/ports/meta-paginas.repository.port';
import type { MetaPaginasRepository } from '../../../pages/application/ports/meta-paginas.repository.port';
import { IngestarLeadGraphUseCase } from './ingestar-lead-graph.use-case';

// Límites Fase 14 (sin cola/Redis, PLAN-FASE-14 §4.3): máx 10 páginas Graph × 50 = 500
// leads por llamada; si sobran, se reporta incompleto + nextCursor para "Continuar" en UI.
const MAX_PAGINAS_GRAPH = 10;
const TAMANO_PAGINA = 50;

export interface BackfillLeadsInput {
  desde?: Date;
  hasta?: Date;
  cursor?: string;
}

export interface ResultadoBackfill {
  importados: number;
  yaExistian: number;
  errores: number;
  incompleto: boolean;
  nextCursor?: string;
}

@Injectable()
export class BackfillLeadsFormularioUseCase {
  private readonly logger = new Logger(BackfillLeadsFormularioUseCase.name);

  constructor(
    @Inject(META_PAGINAS_REPOSITORY)
    private readonly paginas: MetaPaginasRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly ingestar: IngestarLeadGraphUseCase,
  ) {}

  async execute(
    organizacionId: string,
    metaPaginaId: string,
    formId: string,
    input: BackfillLeadsInput,
    /** Compartido entre formularios por SincronizarLeadsOrganizacionUseCase
     * para evitar reconsultar a Graph la misma campaña/conjunto/anuncio. */
    cacheNombres: Map<string, string | null> = new Map(),
  ): Promise<ResultadoBackfill> {
    const pagina = await this.paginas.findPorId(organizacionId, metaPaginaId);
    if (!pagina) {
      throw new NotFoundException('Página no encontrada');
    }

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const userAccessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const pageAccessToken = await this.graph.obtenerAccessTokenPagina(
      pagina.pageId,
      userAccessToken,
    );
    if (!pageAccessToken) {
      throw new NotFoundException(
        'No se pudo obtener el token de la página — verifica los permisos otorgados en Meta',
      );
    }

    let importados = 0;
    let yaExistian = 0;
    let errores = 0;
    let cursor = input.cursor;
    let incompleto = false;

    for (let intento = 0; intento < MAX_PAGINAS_GRAPH; intento += 1) {
      const respuesta = await this.graph.listarLeadsDeForm(
        formId,
        pageAccessToken,
        {
          desde: input.desde,
          hasta: input.hasta,
          despues: cursor,
          limit: TAMANO_PAGINA,
        },
      );

      // Pre-calienta el cache con UNA llamada batch (ids=) para todas las
      // campañas/conjuntos/anuncios de esta página de leads, en vez de dejar
      // que cada lead dispare su propia llamada individual a Graph.
      const idsFaltantes = new Set<string>();
      for (const lead of respuesta.leads) {
        for (const id of [lead.campaignId, lead.adsetId, lead.adId]) {
          if (id && !cacheNombres.has(id)) idsFaltantes.add(id);
        }
      }
      if (idsFaltantes.size > 0) {
        const nombres = await this.graph.obtenerNombresRecursos(
          [...idsFaltantes],
          userAccessToken,
        );
        for (const [id, nombre] of nombres) cacheNombres.set(id, nombre);
      }

      for (const lead of respuesta.leads) {
        try {
          const resultado = await this.ingestar.execute(
            organizacionId,
            metaPaginaId,
            userAccessToken,
            lead,
            cacheNombres,
          );
          if (resultado.creado) importados += 1;
          else yaExistian += 1;
        } catch (error) {
          errores += 1;
          this.logger.warn(
            `Backfill: falló el lead ${lead.leadgenId} del form ${formId}`,
            error instanceof Error ? error.stack : error,
          );
        }
      }

      cursor = respuesta.siguienteCursor;
      if (!cursor) break;
      if (intento === MAX_PAGINAS_GRAPH - 1) incompleto = true;
    }

    return {
      importados,
      yaExistian,
      errores,
      incompleto,
      nextCursor: incompleto ? cursor : undefined,
    };
  }
}
