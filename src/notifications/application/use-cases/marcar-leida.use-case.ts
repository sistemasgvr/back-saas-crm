import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY } from '../ports/notificaciones.repository.port';
import type { NotificacionesRepository } from '../ports/notificaciones.repository.port';

@Injectable()
export class MarcarLeidaUseCase {
  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly repo: NotificacionesRepository,
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
  }
}
