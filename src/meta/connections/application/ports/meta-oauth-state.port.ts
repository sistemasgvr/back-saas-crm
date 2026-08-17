import type { MetaOAuthState } from '../../domain/oauth-state.interface';

export const META_OAUTH_STATE_SERVICE = Symbol('META_OAUTH_STATE_SERVICE');

export interface MetaOAuthStateService {
  firmar(state: MetaOAuthState): string;
  /** Devuelve null si el state es inválido, fue alterado o expiró. */
  verificar(state: string): MetaOAuthState | null;
}
