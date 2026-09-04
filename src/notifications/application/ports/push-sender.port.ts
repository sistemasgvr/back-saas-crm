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
  enviarAUsuarios(
    usuarioIds: string[],
    data: PushNotificationPayload,
    organizacionId?: string,
  ): Promise<void>;
}
