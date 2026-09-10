export const PUSH_SENDER = Symbol('PUSH_SENDER');

export interface PushNotificationPayload {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  payload?: Record<string, unknown> | null;
}

export interface PushSender {
  habilitado(): boolean;
  publicKey(): string | null;
  /**
   * Envía Web Push a las suscripciones activas.
   * @returns cantidad de suscripciones a las que se intentó enviar (0 si push off o sin subs).
   */
  enviarAUsuarios(
    usuarioIds: string[],
    data: PushNotificationPayload,
    organizacionId?: string,
  ): Promise<number>;
}
