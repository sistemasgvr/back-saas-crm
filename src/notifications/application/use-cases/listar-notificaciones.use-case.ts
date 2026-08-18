import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY } from '../ports/notificaciones.repository.port';
import type { NotificacionesRepository } from '../ports/notificaciones.repository.port';

@Injectable()
export class ListarNotificacionesUseCase {
  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly repo: NotificacionesRepository,
  ) {}

  execute(
    organizacionId: string,
    usuarioId: string,
    page: number,
    pageSize: number,
  ) {
    return this.repo.listarPorUsuario(
      organizacionId,
      usuarioId,
      page,
      pageSize,
    );
  }
}
