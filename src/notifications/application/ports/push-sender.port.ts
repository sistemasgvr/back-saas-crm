export const PUSH_SENDER = Symbol('PUSH_SENDER');

export interface PushNotificationPayload {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  payload?: Record<string, unknown> | null;
}

export interface PushSendResult {
  attempted: number;
  delivered: number;
  failed: number;
}

export interface PushSender {
  habilitado(): boolean;
  publicKey(): string | null;
  /**
   * Envía Web Push a las suscripciones activas del usuario (cualquier org).
   * `organizacionId` se ignora en el filtro de envío (compat API).
   */
  enviarAUsuarios(
    usuarioIds: string[],
    data: PushNotificationPayload,
    organizacionId?: string,
  ): Promise<PushSendResult>;
}
