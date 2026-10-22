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

    // Siempre se piden juntos todos los permisos que usa el CRM hoy (núcleo
    // aplicables a los módulos de la org) + los opt-in marcados: «Conectar»,
    // «Solicitar permisos» y «Otorgar en Meta» resuelven todo en un solo
    // diálogo. `features` agrega opt-in puntuales (PLAN.md Fase 16).
    const modulosActivos = new Set(
      await this.conexiones.listarModulosActivos(organizacionId),
    );
    const scope = scopesDeFeatures([
      ...featuresDeseadasDe(conexion.featuresDeseadas, modulosActivos),
      ...(features ?? []),
    ]);

    const params = new URLSearchParams({
      client_id: conexion.appId,
      redirect_uri: this.config.getOrThrow<string>('META_OAUTH_REDIRECT_URI'),
      state,
      scope: scope.join(','),
      response_type: 'code',
    });
    // Fuerza que Meta vuelva a mostrar los permisos que el usuario haya
    // denegado antes — sin esto, un permiso rechazado una vez no se vuelve a
    // preguntar (PLAN.md Fase 16).
    if (rerequest) {
      params.set('auth_type', 'rerequest');
    }

    const version = obtenerVersionGraph(this.config);
    return {
      url: `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`,
    };
  }
}
