import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { MetaOAuthState } from '../domain/oauth-state.interface';
import type { MetaOAuthStateService } from '../application/ports/meta-oauth-state.port';

@Injectable()
export class JwtMetaOAuthStateService implements MetaOAuthStateService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  firmar(state: MetaOAuthState): string {
    return this.jwt.sign(state, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '10m',
    });
  }

  verificar(state: string): MetaOAuthState | null {
    try {
      const payload = this.jwt.verify<MetaOAuthState>(state, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      return {
        organizacionId: payload.organizacionId,
        usuarioId: payload.usuarioId,
      };
    } catch {
      return null;
    }
  }
}
