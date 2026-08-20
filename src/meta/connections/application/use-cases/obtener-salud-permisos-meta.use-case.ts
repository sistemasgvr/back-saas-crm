import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../ports/meta-graph-client.port';
import type { MetaGraphClient } from '../ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import {
  featuresDeseadasDe,
  MATRIZ_PERMISOS_META,
} from '../meta-permisos-matriz';

export interface FeaturePermisoEstado {
  id: string;
  label: string;
  tipo: 'nucleo' | 'optin';
  deseada: boolean;
  estado: 'ok' | 'falta';
  scopesRequeridos: string[];
  scopesFaltantes: string[];
  puedeDesactivar: boolean;
}

export interface SaludPermisosMeta {
  isValid: boolean;
  scopesOtorgados: string[];
  features: FeaturePermisoEstado[];
  tieneFaltantesDeseados: boolean;
  notaAdvancedAccess: string;
}

const NOTA_ADVANCED_ACCESS =
  'Si un permiso aparece OK pero no ves páginas o cuentas de clientes, puede faltar Advanced Access / App Review en la Meta App — eso no lo expone la API al token del usuario.';

/** Fuente siempre viva contra Graph (debug_token) — la columna scopes en BD es
 * solo cache/auditoría (PLAN.md Fase 16). */
@Injectable()
export class ObtenerSaludPermisosMetaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string): Promise<SaludPermisosMeta> {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (
      !conexion?.tokenCifrado ||
      !conexion.appId ||
      !conexion.appSecretCifrado
    ) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    const appSecret = this.tokenEncryption.decrypt(conexion.appSecretCifrado);
    const debug = await this.graph.debugToken(
      accessToken,
      conexion.appId,
      appSecret,
    );

    const deseadas = new Set(featuresDeseadasDe(conexion.featuresDeseadas));

    const features: FeaturePermisoEstado[] = MATRIZ_PERMISOS_META.map(
      (feature) => {
        const scopesFaltantes = feature.scopesRequeridos.filter(
          (scope) => !debug.scopes.includes(scope),
        );
        return {
          id: feature.id,
          label: feature.label,
          tipo: feature.tipo,
          deseada: deseadas.has(feature.id),
          estado: scopesFaltantes.length === 0 ? 'ok' : 'falta',
          scopesRequeridos: feature.scopesRequeridos,
          scopesFaltantes,
          puedeDesactivar: feature.tipo === 'optin',
        };
      },
    );

    return {
      isValid: debug.isValid,
      scopesOtorgados: debug.scopes,
      features,
      tieneFaltantesDeseados: features.some(
        (feature) => feature.deseada && feature.estado === 'falta',
      ),
      notaAdvancedAccess: NOTA_ADVANCED_ACCESS,
    };
  }
}
