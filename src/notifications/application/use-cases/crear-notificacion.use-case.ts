import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICACIONES_REPOSITORY } from '../ports/notificaciones.repository.port';
import type { NotificacionesRepository } from '../ports/notificaciones.repository.port';
import { WS_EMITTER } from '../ports/ws-emitter.port';
import type { WsEmitter } from '../ports/ws-emitter.port';
import { PUSH_SENDER } from '../ports/push-sender.port';
import type { PushSender } from '../ports/push-sender.port';

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
 * Punto de entrada genérico para disparar cualquier tipo de notificación.
 * Persiste, emite por WebSocket y, si hay VAPID, envía Web Push a los
 * dispositivos suscritos (móvil / pestaña cerrada).
 */
@Injectable()
export class CrearNotificacionUseCase {
  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly repo: NotificacionesRepository,
    @Inject(WS_EMITTER) private readonly wsEmitter: WsEmitter,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
  ) {}

  async execute(input: CrearNotificacionInput): Promise<{ id: string } | void> {
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

    const evento = {
      id: creada.id,
      tipo: creada.tipo,
      titulo: creada.titulo,
      mensaje: creada.mensaje,
      payload: creada.payload,
      fechaCreacion: creada.fechaCreacion,
    };

    this.wsEmitter.emitirAUsuarios(usuarioIds, 'notificacion:nueva', evento);

    void this.pushSender.enviarAUsuarios(usuarioIds, {
      id: creada.id,
      tipo: creada.tipo,
      titulo: creada.titulo,
      mensaje: creada.mensaje,
      payload: creada.payload as Record<string, unknown> | null,
    });

    return { id: creada.id };
  }
}
