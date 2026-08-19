import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from '../ports/meta-cuentas-publicitarias.repository.port';
import type { MetaCuentasPublicitariasRepository } from '../ports/meta-cuentas-publicitarias.repository.port';

export interface ResultadoSync {
  campanas: number;
  conjuntos: number;
  anuncios: number;
}

/**
 * Sync manual bajo demanda (PLAN-FASE-13-META-MULTI.md §4.6) — sin colas en esta
 * fase. Un fallo en una campaña/conjunto individual se loguea y no interrumpe el
 * resto (una cuenta con muchas campañas no debe fallar entera por una sola mala).
 */
@Injectable()
export class SincronizarCuentaUseCase {
  private readonly logger = new Logger(SincronizarCuentaUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_CUENTAS_PUBLICITARIAS_REPOSITORY)
    private readonly cuentas: MetaCuentasPublicitariasRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    @Inject(CAMPANAS_REPOSITORY) private readonly campanas: CampanasRepository,
    @Inject(CONJUNTOS_ANUNCIOS_REPOSITORY)
    private readonly conjuntos: ConjuntosAnunciosRepository,
    @Inject(ANUNCIOS_REPOSITORY) private readonly anuncios: AnunciosRepository,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    usuarioEdicion: string,
  ): Promise<ResultadoSync> {
    const cuenta = await this.cuentas.findPorId(organizacionId, id);
    if (!cuenta) {
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    }

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const resultado: ResultadoSync = { campanas: 0, conjuntos: 0, anuncios: 0 };

    const campanasGraph = await this.graph.listarCampanasDeCuenta(
      cuenta.adAccountId,
      accessToken,
    );

    for (const campanaGraph of campanasGraph) {
      try {
        const campanaLocal = await this.campanas.upsertPorMetaId({
          organizacionId,
          metaCampanaId: campanaGraph.id,
          nombre: campanaGraph.nombre,
          estadoMeta: campanaGraph.estado,
          metaCuentaPublicitariaId: cuenta.id,
        });
        resultado.campanas += 1;

        const conjuntosGraph = await this.graph.listarConjuntosDeCampana(
          campanaGraph.id,
          accessToken,
        );
        for (const conjuntoGraph of conjuntosGraph) {
          try {
            const conjuntoLocal = await this.conjuntos.upsertPorMetaId({
              organizacionId,
              campanaId: campanaLocal.id,
              metaConjuntoId: conjuntoGraph.id,
              nombre: conjuntoGraph.nombre,
              estadoMeta: conjuntoGraph.estado,
            });
            resultado.conjuntos += 1;

            const anunciosGraph = await this.graph.listarAnunciosDeConjunto(
              conjuntoGraph.id,
              accessToken,
            );
            for (const anuncioGraph of anunciosGraph) {
              try {
                await this.anuncios.upsertPorMetaId({
                  organizacionId,
                  conjuntoAnuncioId: conjuntoLocal.id,
                  metaAnuncioId: anuncioGraph.id,
                  nombre: anuncioGraph.nombre,
                  estadoMeta: anuncioGraph.estado,
                });
                resultado.anuncios += 1;
              } catch (error) {
                this.logger.warn(
                  `Sync: falló el anuncio ${anuncioGraph.id}`,
                  error instanceof Error ? error.stack : error,
                );
              }
            }
          } catch (error) {
            this.logger.warn(
              `Sync: falló el conjunto ${conjuntoGraph.id}`,
              error instanceof Error ? error.stack : error,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Sync: falló la campaña ${campanaGraph.id}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    await this.cuentas.actualizarUltimoSync(cuenta.id, usuarioEdicion);
    return resultado;
  }
}
