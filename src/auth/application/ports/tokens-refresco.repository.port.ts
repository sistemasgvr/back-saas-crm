import { TokenRefresco } from '@prisma/client';

export const TOKENS_REFRESCO_REPOSITORY = Symbol('TOKENS_REFRESCO_REPOSITORY');

export interface CrearTokenRefrescoInput {
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
  ip?: string;
  userAgent?: string;
}

export interface TokensRefrescoRepository {
  crear(input: CrearTokenRefrescoInput): Promise<void>;
  findVigentePorHash(tokenHash: string): Promise<TokenRefresco | null>;
  revocar(id: string): Promise<void>;
}
