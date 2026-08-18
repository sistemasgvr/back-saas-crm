import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY } from '../ports/notificaciones.repository.port';
import type { NotificacionesRepository } from '../ports/notificaciones.repository.port';

@Injectable()
export class MarcarTodasLeidasUseCase {
  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly repo: NotificacionesRepository,
  ) {}

  execute(organizacionId: string, usuarioId: string) {
    return this.repo.marcarTodasLeidas(organizacionId, usuarioId);
  }
}
