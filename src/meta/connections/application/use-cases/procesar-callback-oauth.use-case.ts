import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_OAUTH_STATE_SERVICE } from '../ports/meta-oauth-state.port';
import type { MetaOAuthStateService } from '../ports/meta-oauth-state.port';
import { META_GRAPH_CLIENT } from '../ports/meta-graph-client.port';
import type { MetaGraphClient } from '../ports/meta-graph-client.port';
import { META_CONEXIONES_REPOSITORY } from '../ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../ports/meta-conexiones.repository.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';

export interface ProcesarCallbackInput {
  code: string;
  state: string;
}

@Injectable()
export class ProcesarCallbackOAuthUseCase {
  constructor(
    @Inject(META_OAUTH_STATE_SERVICE)
    private readonly oauthState: MetaOAuthStateService,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    input: ProcesarCallbackInput,
  ): Promise<{ organizacionId: string }> {
    const state = this.oauthState.verificar(input.state);
    if (!state) {
      throw new UnauthorizedException('state de OAuth inválido o expirado');
    }

    const conexion = await this.conexiones.findActivaPorOrganizacion(
      state.organizacionId,
    );
    if (!conexion?.appId || !conexion.appSecretCifrado) {
      throw new UnauthorizedException(
        'No hay credenciales de Meta App guardadas para esta organización',
      );
    }
    const appSecret = this.tokenEncryption.decrypt(conexion.appSecretCifrado);

    const redirectUri = this.config.getOrThrow<string>(
      'META_OAUTH_REDIRECT_URI',
    );
    const corto = await this.graph.intercambiarCodigoPorToken(
      input.code,
      redirectUri,
      conexion.appId,
      appSecret,
    );
    const largo = await this.graph.intercambiarPorTokenLargaDuracion(
      corto.accessToken,
      conexion.appId,
      appSecret,
    );
    const usuarioMeta = await this.graph.obtenerUsuario(largo.accessToken);

    const tokenExpiraEn = largo.expiraEnSegundos
      ? new Date(Date.now() + largo.expiraEnSegundos * 1000)
      : undefined;

    // Scopes reales otorgados (no lo que se pidió) — PLAN.md Fase 16
    // §7.3: "no confiar solo en lo pedido". Un fallo acá no debe romper la conexión.
    let scopes: string | undefined;
    try {
      const debug = await this.graph.debugToken(
        largo.accessToken,
        conexion.appId,
        appSecret,
      );
      scopes = debug.scopes.join(',');
    } catch {
      scopes = undefined;
    }

    await this.conexiones.actualizarTokenOAuth({
      organizacionId: state.organizacionId,
      metaUserId: usuarioMeta.id,
      metaUserNombre: usuarioMeta.nombre,
      tokenCifrado: this.tokenEncryption.encrypt(largo.accessToken),
      tokenExpiraEn,
      scopes,
      usuarioEdicion: state.usuarioId,
    });

    return { organizacionId: state.organizacionId };
  }
}
