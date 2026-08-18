export const WS_EMITTER = Symbol('WS_EMITTER');

export interface WsEmitter {
  emitirAUsuarios(usuarioIds: string[], evento: string, data: unknown): void;
}
