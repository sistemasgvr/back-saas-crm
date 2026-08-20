import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../connections/application/ports/meta-graph-client.port';
import type {
  MetaGraphClient,
  MetaInsightGraph,
} from '../../../connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../../../ad-accounts/application/ports/meta-cuentas-publicitarias.repository.port';
import { CAMPANAS_REPOSITORY } from '../../../campaigns/application/ports/campanas.repository.port';
import type { CampanasRepository } from '../../../campaigns/application/ports/campanas.repository.port';
import { META_INSIGHTS_REPOSITORY } from '../ports/meta-insights.repository.port';
import type { MetaInsightsRepository } from '../ports/meta-insights.repository.port';

// Límites Fase 15 (sin cola/Redis, PLAN.md): 31 días por sync on-demand.
const RANGO_MAXIMO_DIAS = 31;

export interface SincronizarInsightsInput {
  desde: string;
  hasta: string;
}

export interface ResultadoSyncInsights {
  filasCuenta: number;
  filasCampana: number;
  errores: number;
  moneda: string | null;
}

function fechaUtcDelDia(fechaYYYYMMDD: string): Date {
  return new Date(`${fechaYYYYMMDD}T00:00:00.000Z`);
}

/** Sync manual bajo demanda (PLAN.md Fase 15) — pull Insights a
 * nivel cuenta y campaña en el mismo request; sin cola, sin cron. */
@Injectable()
export class SincronizarInsightsCuentaUseCase {
  private readonly logger = new Logger(SincronizarInsightsCuentaUseCase.name);

  constructor(
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_INSIGHTS_REPOSITORY)
    private readonly insights: MetaInsightsRepository,
    @Inject(CAMPANAS_REPOSITORY) private readonly campanas: CampanasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    metaCuentaPublicitariaId: string,
    input: SincronizarInsightsInput,
    usuarioEdicion: string,
  ): Promise<ResultadoSyncInsights> {
    const cuenta = await this.cuentas.findPorId(
      organizacionId,
      metaCuentaPublicitariaId,
    );
    if (!cuenta) {
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    }

    const dias = Math.ceil(
      (fechaUtcDelDia(input.hasta).getTime() -
        fechaUtcDelDia(input.desde).getTime()) /
        86_400_000,
    );
    if (dias < 0 || dias > RANGO_MAXIMO_DIAS) {
      throw new BadRequestException(
        `El rango no puede superar ${RANGO_MAXIMO_DIAS} días`,
      );
    }

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }
    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);

    let filasCuenta = 0;
    let filasCampana = 0;
    let errores = 0;
    let moneda: string | null = null;

    const upsertItem = async (item: MetaInsightGraph, campanaId?: string) => {
      moneda = moneda ?? item.moneda ?? null;
      await this.insights.upsertDiario({
        organizacionId,
        metaCuentaPublicitariaId: cuenta.id,
        campanaId,
        fecha: fechaUtcDelDia(item.fecha),
        spend: item.spend,
        impressions: item.impressions,
        clicks: item.clicks,
        ctr: item.ctr,
        cpc: item.cpc,
        reach: item.reach,
        moneda: item.moneda,
        datosCrudos: item,
        usuarioEdicion,
      });
    };

    const insightsCuenta = await this.graph.obtenerInsights(
      cuenta.adAccountId,
      accessToken,
      {
        desde: input.desde,
        hasta: input.hasta,
        nivel: 'account',
      },
    );
    for (const item of insightsCuenta) {
      try {
        await upsertItem(item);
        filasCuenta += 1;
      } catch (error) {
        errores += 1;
        this.logger.warn(
          `Sync insights: falló el snapshot de cuenta ${cuenta.adAccountId} del ${item.fecha}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    const insightsCampana = await this.graph.obtenerInsights(
      cuenta.adAccountId,
      accessToken,
      {
        desde: input.desde,
        hasta: input.hasta,
        nivel: 'campaign',
      },
    );
    for (const item of insightsCampana) {
      if (!item.campanaMetaId) continue;
      try {
        const campanaLocal = await this.campanas.upsertPorMetaId({
          organizacionId,
          metaCampanaId: item.campanaMetaId,
          nombre: item.campanaNombre ?? item.campanaMetaId,
          metaCuentaPublicitariaId: cuenta.id,
        });
        await upsertItem(item, campanaLocal.id);
        filasCampana += 1;
      } catch (error) {
        errores += 1;
        this.logger.warn(
          `Sync insights: falló la campaña ${item.campanaMetaId} del ${item.fecha}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    await this.cuentas.actualizarUltimoSync(cuenta.id, usuarioEdicion);

    return { filasCuenta, filasCampana, errores, moneda };
  }
}
