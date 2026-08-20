import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../ports/meta-graph-client.port';
import type { MetaGraphClient } from '../ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { buscarFeature, featuresDeseadasDe } from '../meta-permisos-matriz';

export interface TogglearFeatureInput {
  featureId: string;
  deseada: boolean;
  /** Solo aplica al apagar (§4.2 D3): además de dejar de pedirla, revocarla ya en Meta. */
  revocarEnMeta?: boolean;
}

/** Preferencia CRM (qué queremos pedir) — no confundir con el estado real del
 * token, que solo lo da debug_token (PLAN.md Fase 16). */
@Injectable()
export class TogglearFeaturePermisoUseCase {
  private readonly logger = new Logger(TogglearFeaturePermisoUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    input: TogglearFeatureInput,
    usuarioEdicion: string,
  ): Promise<void> {
    const feature = buscarFeature(input.featureId);
    if (!feature) {
      throw new BadRequestException(`Feature desconocida: ${input.featureId}`);
    }
    if (feature.tipo === 'nucleo') {
      throw new BadRequestException(
        'Esta feature es núcleo de Lead Ads y no se puede desactivar',
      );
    }

    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new NotFoundException(
        'No hay una conexión Meta para esta organización',
      );
    }

    const actuales = new Set(featuresDeseadasDe(conexion.featuresDeseadas));
    if (input.deseada) {
      actuales.add(input.featureId);
    } else {
      actuales.delete(input.featureId);
    }
    const optinDeseadas = [...actuales].filter(
      (id) => buscarFeature(id)?.tipo === 'optin',
    );
    await this.conexiones.actualizarFeaturesDeseadas(
      conexion.id,
      optinDeseadas,
      usuarioEdicion,
    );

    if (input.deseada || !input.revocarEnMeta) {
      return;
    }

    // Hard off: revocar en Meta además de dejar de pedirlo (§4.2 D3).
    if (!conexion.tokenCifrado || !conexion.metaUserId) {
      return;
    }
    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);

    for (const scope of feature.scopesRequeridos) {
      try {
        await this.graph.revocarPermiso(
          conexion.metaUserId,
          scope,
          accessToken,
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo revocar el scope ${scope} en Meta para la org ${organizacionId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    // Refrescar el cache de scopes (auditoría) tras la revocación.
    if (conexion.appId && conexion.appSecretCifrado) {
      try {
        const appSecret = this.tokenEncryption.decrypt(
          conexion.appSecretCifrado,
        );
        const debug = await this.graph.debugToken(
          accessToken,
          conexion.appId,
          appSecret,
        );
        await this.conexiones.actualizarTokenOAuth({
          organizacionId,
          metaUserId: conexion.metaUserId,
          tokenCifrado: conexion.tokenCifrado,
          scopes: debug.scopes.join(','),
          usuarioEdicion,
        });
      } catch (error) {
        this.logger.warn(
          `No se pudo refrescar scopes tras revocar en la org ${organizacionId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }
}
