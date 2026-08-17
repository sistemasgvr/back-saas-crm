import { Inject, Injectable } from '@nestjs/common';
import { TOKEN_SERVICE } from '../ports/token.service.port';
import type { TokenService } from '../ports/token.service.port';
import { TOKENS_REFRESCO_REPOSITORY } from '../ports/tokens-refresco.repository.port';
import type { TokensRefrescoRepository } from '../ports/tokens-refresco.repository.port';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(TOKENS_REFRESCO_REPOSITORY)
    private readonly tokensRefresco: TokensRefrescoRepository,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashToken(refreshToken);
    const fila = await this.tokensRefresco.findVigentePorHash(tokenHash);
    if (fila) {
      await this.tokensRefresco.revocar(fila.id);
    }
  }
}
