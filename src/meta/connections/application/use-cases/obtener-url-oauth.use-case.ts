import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_OAUTH_STATE_SERVICE } from '../ports/meta-oauth-state.port';
import type { MetaOAuthStateService } from '../ports/meta-oauth-state.port';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { obtenerVersionGraph } from '../../../../shared/infrastructure/meta-graph-version';

// Lead Ads + lectura de anuncios/páginas (PLAN.md §8.1).
const SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'leads_retrieval',
  'ads_read',
].join(',');

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
  ): Promise<{ url: string }> {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.appId) {
      throw new BadRequestException(
        'Registra tu Meta App (App ID y App Secret) antes de conectar',
      );
    }

    const state = this.oauthState.firmar({ organizacionId, usuarioId });

    const params = new URLSearchParams({
      client_id: conexion.appId,
      redirect_uri: this.config.getOrThrow<string>('META_OAUTH_REDIRECT_URI'),
      state,
      scope: SCOPES,
      response_type: 'code',
    });

    const version = obtenerVersionGraph(this.config);
    return {
      url: `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`,
    };
  }
}
