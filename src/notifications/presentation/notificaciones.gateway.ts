import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { WsTicketService } from '../infrastructure/ws-ticket.service';
import type { WsEmitter } from '../application/ports/ws-emitter.port';

interface SocketData {
  usuarioId: string;
  organizacionId: string;
}

// Sin `cors` acá: se configura globalmente en main.ts vía ConfigIoAdapter,
// porque los decoradores no pueden inyectar ConfigService.
@WebSocketGateway({ namespace: '/notifications' })
export class NotificacionesGateway implements OnGatewayConnection, WsEmitter {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(NotificacionesGateway.name);

  constructor(private readonly wsTicket: WsTicketService) {}

  async handleConnection(client: Socket): Promise<void> {
    const ticket = client.handshake.auth?.ticket as string | undefined;
    const payload = ticket ? this.wsTicket.verificar(ticket) : null;

    if (!payload) {
      this.logger.warn(
        `Conexión WS rechazada: ticket inválido o ausente (${client.id})`,
      );
      client.disconnect(true);
      return;
    }

    const data = client.data as SocketData;
    data.usuarioId = payload.sub;
    data.organizacionId = payload.organizacionId;
    await client.join(`org:${payload.organizacionId}`);
    await client.join(`user:${payload.sub}`);
  }

  emitirAUsuarios(usuarioIds: string[], evento: string, data: unknown): void {
    for (const usuarioId of usuarioIds) {
      this.server.to(`user:${usuarioId}`).emit(evento, data);
    }
  }
}
