import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../ports/meta-graph-client.port';
import type { MetaGraphClient } from '../ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import {
  featureAplica,
  featuresDeseadasDe,
  MATRIZ_PERMISOS_META,
  scopesDeFeatures,
} from '../meta-permisos-matriz';
import type { GrupoPermisoMeta } from '../meta-permisos-matriz';

export interface FeaturePermisoEstado {
  id: string;
  label: string;
  descripcion: string;
  grupo: GrupoPermisoMeta;
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
  /** Todo lo que pide «Solicitar permisos» (núcleo aplicables + opt-in marcados). */
  scopesSolicitados: string[];
  /** Scopes de funcionalidades actuales que el token aún no tiene. */
  scopesRequeridosFaltantes: string[];
  features: FeaturePermisoEstado[];
  tieneFaltantesDeseados: boolean;
  notaAdvancedAccess: string;
}

const NOTA_ADVANCED_ACCESS =
  'En el diálogo de Meta selecciona todas las páginas, cuentas publicitarias, portafolios y cuentas de WhatsApp que el CRM debe usar. ' +
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
    const [debug, modulos] = await Promise.all([
      this.graph.debugToken(accessToken, conexion.appId, appSecret),
      this.conexiones.listarModulosActivos(organizacionId),
    ]);
    const modulosActivos = new Set(modulos);

    const idsDeseados = featuresDeseadasDe(
      conexion.featuresDeseadas,
      modulosActivos,
    );
    const deseadas = new Set(idsDeseados);

    // Las núcleo de un módulo que la org no tiene no se listan: no se piden.
    const features: FeaturePermisoEstado[] = MATRIZ_PERMISOS_META.filter(
      (feature) => featureAplica(feature, modulosActivos),
    ).map((feature) => {
      const scopesFaltantes = feature.scopesRequeridos.filter(
        (scope) => !debug.scopes.includes(scope),
      );
      return {
        id: feature.id,
        label: feature.label,
        descripcion: feature.descripcion,
        grupo: feature.grupo,
        tipo: feature.tipo,
        deseada: deseadas.has(feature.id),
        estado: scopesFaltantes.length === 0 ? 'ok' : 'falta',
        scopesRequeridos: feature.scopesRequeridos,
        scopesFaltantes,
        puedeDesactivar: feature.tipo === 'optin',
      };
    });

    const scopesRequeridosFaltantes = [
      ...new Set(
        features
          .filter((feature) => feature.tipo === 'nucleo')
          .flatMap((feature) => feature.scopesFaltantes),
      ),
    ];

    return {
      isValid: debug.isValid,
      scopesOtorgados: debug.scopes,
      scopesSolicitados: scopesDeFeatures(idsDeseados),
      scopesRequeridosFaltantes,
      features,
      tieneFaltantesDeseados: features.some(
        (feature) => feature.deseada && feature.estado === 'falta',
      ),
      notaAdvancedAccess: NOTA_ADVANCED_ACCESS,
    };
  }
}
