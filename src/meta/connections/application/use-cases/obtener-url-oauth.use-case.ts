import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_OAUTH_STATE_SERVICE } from '../ports/meta-oauth-state.port';
import type { MetaOAuthStateService } from '../ports/meta-oauth-state.port';

const GRAPH_VERSION = 'v21.0';
// Lead Ads + lectura de anuncios/páginas (PLAN.md §8.1).
const SCOPES = ['pages_show_list', 'pages_manage_metadata', 'leads_retrieval', 'ads_read'].join(',');

@Injectable()
export class ObtenerUrlOAuthUseCase {
  constructor(
    private readonly config: ConfigService,
    @Inject(META_OAUTH_STATE_SERVICE) private readonly oauthState: MetaOAuthStateService,
  ) {}

  execute(organizacionId: string, usuarioId: string): { url: string } {
    const state = this.oauthState.firmar({ organizacionId, usuarioId });

    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      redirect_uri: this.config.getOrThrow<string>('META_OAUTH_REDIRECT_URI'),
      state,
      scope: SCOPES,
      response_type: 'code',
    });

    return { url: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}` };
  }
}
