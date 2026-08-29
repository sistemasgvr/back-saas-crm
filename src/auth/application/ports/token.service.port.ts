import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../domain/jwt-payload.interface';

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface EmitidoRefreshToken {
  token: string;
  tokenHash: string;
  expiraEn: Date;
}

export interface TokenService {
  firmarAccessToken(payload: AccessTokenPayload): string;
  firmarRefreshToken(payload: RefreshTokenPayload): EmitidoRefreshToken;
  verificarRefreshToken(token: string): RefreshTokenPayload | null;
  hashToken(token: string): string;
}
