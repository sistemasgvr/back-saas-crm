import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { WS_EMITTER } from '../../../notifications/application/ports/ws-emitter.port';
import type { WsEmitter } from '../../../notifications/application/ports/ws-emitter.port';

/** Qué cambió en el chat — el front decide qué refrescar (hilo, lista, contador). */
export type CambioChat =
  'mensaje' | 'eco' | 'saliente' | 'estado' | 'reaccion' | 'edicion' | 'media';

export const EVENTO_CAMBIO_CHAT = 'whatsapp:chat';

export interface EventoCambioChat {
  conversacionId: string;
  cambios: CambioChat[];
}

interface Ventana {
  timer: ReturnType<typeof setTimeout>;
  pendientes: Set<CambioChat>;
}

/**
 * Aviso en vivo por Socket.IO de que un chat cambió (mensaje entrante, eco
 * del celular, ✓✓, reacción, edición, archivo listo…). Va a toda la org con
 * payload mínimo (solo id + tipo de cambio, sin contenido): cada cliente
 * vuelve a pedir el hilo/lista por los endpoints que ya filtran permisos, así
 * que nadie ve chats ajenos por este canal.
 *
 * Agrupación por chat (throttle leading + trailing): el primer cambio sale al
 * instante; los que llegan dentro de la ventana salen juntos al cerrarla. Un
 * history sync o una ráfaga de estados no inunda sockets ni dispara un refetch
 * por evento.
 */
@Injectable()
export class TiempoRealChatsService implements OnModuleDestroy {
  static readonly VENTANA_MS = 400;

  private readonly ventanas = new Map<string, Ventana>();

  constructor(@Inject(WS_EMITTER) private readonly ws: WsEmitter) {}

  notificar(
    organizacionId: string,
    conversacionId: string,
    cambio: CambioChat,
  ): void {
    const clave = `${organizacionId}:${conversacionId}`;
    const abierta = this.ventanas.get(clave);
    if (abierta) {
      abierta.pendientes.add(cambio);
      return;
    }
    this.emitir(organizacionId, conversacionId, [cambio]);
    this.abrirVentana(clave, organizacionId, conversacionId);
  }

  onModuleDestroy(): void {
    for (const ventana of this.ventanas.values()) clearTimeout(ventana.timer);
    this.ventanas.clear();
  }

  private abrirVentana(
    clave: string,
    organizacionId: string,
    conversacionId: string,
  ): void {
    const ventana: Ventana = {
      pendientes: new Set(),
      timer: setTimeout(() => {
        this.ventanas.delete(clave);
        if (ventana.pendientes.size === 0) return;
        this.emitir(organizacionId, conversacionId, [...ventana.pendientes]);
        // Si la ráfaga sigue, la siguiente tanda también queda agrupada.
        this.abrirVentana(clave, organizacionId, conversacionId);
      }, TiempoRealChatsService.VENTANA_MS),
    };
    // No retener el proceso al apagar por un aviso pendiente.
    ventana.timer.unref?.();
    this.ventanas.set(clave, ventana);
  }

  private emitir(
    organizacionId: string,
    conversacionId: string,
    cambios: CambioChat[],
  ): void {
    const evento: EventoCambioChat = { conversacionId, cambios };
    this.ws.emitirAOrganizacion(organizacionId, EVENTO_CAMBIO_CHAT, evento);
  }
}
