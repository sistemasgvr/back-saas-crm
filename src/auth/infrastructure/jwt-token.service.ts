import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { createHash } from 'crypto';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../domain/jwt-payload.interface';
import type {
  EmitidoRefreshToken,
  TokenService,
} from '../application/ports/token.service.port';

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  firmarAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as JwtSignOptions['expiresIn'],
    });
  }

  firmarRefreshToken(payload: RefreshTokenPayload): EmitidoRefreshToken {
    const token = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '30d',
      ) as JwtSignOptions['expiresIn'],
    });

    const decoded: unknown = this.jwt.decode(token);
    const exp =
      typeof decoded === 'object' &&
      decoded !== null &&
      'exp' in decoded &&
      typeof decoded.exp === 'number'
        ? decoded.exp
        : undefined;
    if (typeof exp !== 'number') {
      throw new Error('Refresh token inválido');
    }

    return {
      token,
      tokenHash: this.hashToken(token),
      expiraEn: new Date(exp * 1000),
    };
  }

  verificarRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const payload = this.jwt.verify<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      return { sub: payload.sub, organizacionId: payload.organizacionId };
    } catch {
      return null;
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
