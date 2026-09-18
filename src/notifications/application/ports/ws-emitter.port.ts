export const WS_EMITTER = Symbol('WS_EMITTER');

export interface WsEmitter {
  emitirAUsuarios(usuarioIds: string[], evento: string, data: unknown): void;
  /** Emite a todos los sockets unidos a la room `org:{organizacionId}`. */
  emitirAOrganizacion(
    organizacionId: string,
    evento: string,
    data: unknown,
  ): void;
}
