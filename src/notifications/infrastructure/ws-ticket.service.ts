import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface WsTicketPayload {
  sub: string;
  organizacionId: string;
  purpose: 'ws-ticket';
}

/**
 * Ticket de socket de vida muy corta — el front lo pide vía Server Action
 * (flujo Bearer normal) y lo pasa en el handshake `auth` de Socket.IO en vez
 * de depender de la cookie httpOnly, que no viaja cross-site en producción
 * (front y back están en subdominios distintos de Hostinger).
 */
@Injectable()
export class WsTicketService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  emitir(usuarioId: string, organizacionId: string): string {
    const payload: WsTicketPayload = {
      sub: usuarioId,
      organizacionId,
      purpose: 'ws-ticket',
    };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '60s',
    });
  }

  verificar(ticket: string): WsTicketPayload | null {
    try {
      const payload = this.jwt.verify<WsTicketPayload>(ticket, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      return payload.purpose === 'ws-ticket' ? payload : null;
    } catch {
      return null;
    }
  }
}
