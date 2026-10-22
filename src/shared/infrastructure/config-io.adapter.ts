import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Los decoradores @WebSocketGateway no pueden inyectar ConfigService (se
 * evalúan antes de que exista el contenedor de DI) — el CORS del gateway se
 * configura acá, leyendo FRONTEND_URL como ya hace app.enableCors() para HTTP.
 * Sin credentials: el ticket de socket viaja en el payload `auth` del
 * handshake, nunca en una cookie.
 */
export class ConfigIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const config = this.app.get(ConfigService);
    return super.createIOServer(port, {
      ...options,
      cors: { origin: config.getOrThrow<string>('FRONTEND_URL') },
      // Detectar antes un socket muerto (wifi caído, laptop suspendida): por
      // defecto socket.io tarda hasta 45 s (25 + 20); así el cliente se
      // reconecta y se pone al día en ~25 s. Costo: un ping chico (~1 byte de
      // payload) cada 15 s por pestaña abierta.
      pingInterval: 15_000,
      pingTimeout: 10_000,
    }) as Server;
  }
}
