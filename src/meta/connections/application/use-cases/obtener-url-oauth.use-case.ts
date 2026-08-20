import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_OAUTH_STATE_SERVICE } from '../ports/meta-oauth-state.port';
import type { MetaOAuthStateService } from '../ports/meta-oauth-state.port';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { obtenerVersionGraph } from '../../../../shared/infrastructure/meta-graph-version';
import { featuresDeseadasDe, scopesDeFeatures } from '../meta-permisos-matriz';

@Injectable()
export class ObtenerUrlOAuthUseCase {
  constructor(
    private readonly config: ConfigService,
    @Inject(META_OAUTH_STATE_SERVICE)
    private readonly oauthState: MetaOAuthStateService,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    usuarioId: string,
    rerequest?: boolean,
    features?: string[],
  ): Promise<{ url: string }> {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.appId) {
      throw new BadRequestException(
        'Registra tu Meta App (App ID y App Secret) antes de conectar',
      );
    }

    const state = this.oauthState.firmar({ organizacionId, usuarioId });

    // Con `features` explícito (botón "Otorgar en Meta" de una fila puntual):
    // se pide exactamente esa unión de scopes. Sin `features` (Conectar/Reconectar
    // general): núcleo + lo que la org ya tiene marcado como deseado
    // (PLAN.md Fase 16).
    const scope =
      features && features.length > 0
        ? scopesDeFeatures(features)
        : scopesDeFeatures(featuresDeseadasDe(conexion.featuresDeseadas));

    const params = new URLSearchParams({
      client_id: conexion.appId,
      redirect_uri: this.config.getOrThrow<string>('META_OAUTH_REDIRECT_URI'),
      state,
      scope: scope.join(','),
      response_type: 'code',
    });
    // Fuerza que Meta vuelva a mostrar el diálogo de permisos que el usuario
    // haya denegado antes (PLAN.md Fase 16).
    if (rerequest) {
      params.set('auth_type', 'rerequest');
    }

    const version = obtenerVersionGraph(this.config);
    return {
      url: `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`,
    };
  }
}
