import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY } from '../ports/notificaciones.repository.port';
import type { NotificacionesRepository } from '../ports/notificaciones.repository.port';
import { WS_EMITTER } from '../ports/ws-emitter.port';
import type { WsEmitter } from '../ports/ws-emitter.port';

@Injectable()
export class MarcarLeidaUseCase {
  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly repo: NotificacionesRepository,
    @Inject(WS_EMITTER) private readonly wsEmitter: WsEmitter,
  ) {}

  async execute(
    organizacionId: string,
    usuarioId: string,
    notificacionUsuarioId: string,
  ): Promise<void> {
    const actualizada = await this.repo.marcarLeida(
      organizacionId,
      usuarioId,
      notificacionUsuarioId,
    );
    if (!actualizada) {
      throw new NotFoundException('Notificación no encontrada');
    }
    this.wsEmitter.emitirAUsuarios([usuarioId], 'notificacion:leida', {
      notificacionUsuarioId,
    });
  }
}
