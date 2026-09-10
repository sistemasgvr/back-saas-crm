import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY } from '../ports/notificaciones.repository.port';
import type { NotificacionesRepository } from '../ports/notificaciones.repository.port';
import { WS_EMITTER } from '../ports/ws-emitter.port';
import type { WsEmitter } from '../ports/ws-emitter.port';

@Injectable()
export class MarcarLeidasWhatsappConversacionUseCase {
  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly repo: NotificacionesRepository,
    @Inject(WS_EMITTER) private readonly wsEmitter: WsEmitter,
  ) {}

  async execute(
    organizacionId: string,
    usuarioId: string,
    conversacionId: string,
  ) {
    const count = await this.repo.marcarLeidasPorWhatsappConversacion(
      organizacionId,
      usuarioId,
      conversacionId,
    );
    if (count > 0) {
      this.wsEmitter.emitirAUsuarios([usuarioId], 'notificacion:todas-leidas', {
        count,
      });
    }
    return count;
  }
}
