import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY } from '../ports/notificaciones.repository.port';
import type { NotificacionesRepository } from '../ports/notificaciones.repository.port';
import { WS_EMITTER } from '../ports/ws-emitter.port';
import type { WsEmitter } from '../ports/ws-emitter.port';

export interface CrearNotificacionInput {
  organizacionId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  payload?: Record<string, unknown>;
  /** Si se omite, se resuelven todos los miembros activos de la organización. */
  usuarioIds?: string[];
}

/**
 * Punto de entrada genérico para disparar cualquier tipo de notificación
 * (hoy solo "lead nuevo" lo usa, pero está diseñado para más tipos futuros
 * sin cambios de esquema — el discriminador `tipo` es un string libre).
 */
@Injectable()
export class CrearNotificacionUseCase {
  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly repo: NotificacionesRepository,
    @Inject(WS_EMITTER) private readonly wsEmitter: WsEmitter,
  ) {}

  async execute(input: CrearNotificacionInput): Promise<void> {
    const usuarioIds =
      input.usuarioIds ??
      (await this.repo.findUsuarioIdsActivosDeOrganizacion(
        input.organizacionId,
      ));
    if (usuarioIds.length === 0) return;

    const creada = await this.repo.crearConFanOut({
      organizacionId: input.organizacionId,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje,
      payload: input.payload,
      usuarioIds,
    });

    this.wsEmitter.emitirAUsuarios(usuarioIds, 'notificacion:nueva', {
      id: creada.id,
      tipo: creada.tipo,
      titulo: creada.titulo,
      mensaje: creada.mensaje,
      payload: creada.payload,
      fechaCreacion: creada.fechaCreacion,
    });
  }
}
