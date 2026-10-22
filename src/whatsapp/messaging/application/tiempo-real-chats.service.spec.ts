import { TiempoRealChatsService } from './tiempo-real-chats.service';

function fixture() {
  const ws = {
    emitirAUsuarios: jest.fn(),
    emitirAOrganizacion: jest.fn(),
  };
  const servicio = new TiempoRealChatsService(ws);
  return { servicio, ws };
}

describe('Avisos en vivo de chats', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('el primer cambio sale al instante, sin esperar la ventana', () => {
    const { servicio, ws } = fixture();
    servicio.notificar('org', 'chat-1', 'mensaje');
    expect(ws.emitirAOrganizacion).toHaveBeenCalledWith(
      'org',
      'whatsapp:chat',
      {
        conversacionId: 'chat-1',
        cambios: ['mensaje'],
      },
    );
  });

  it('agrupa una ráfaga del mismo chat en un solo aviso al cerrar la ventana', () => {
    const { servicio, ws } = fixture();
    servicio.notificar('org', 'chat-1', 'mensaje');
    servicio.notificar('org', 'chat-1', 'estado');
    servicio.notificar('org', 'chat-1', 'estado');
    servicio.notificar('org', 'chat-1', 'media');
    expect(ws.emitirAOrganizacion).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(TiempoRealChatsService.VENTANA_MS);
    expect(ws.emitirAOrganizacion).toHaveBeenCalledTimes(2);
    expect(ws.emitirAOrganizacion).toHaveBeenLastCalledWith(
      'org',
      'whatsapp:chat',
      { conversacionId: 'chat-1', cambios: ['estado', 'media'] },
    );

    // Sin más cambios, la ventana se cierra sin avisos extra.
    jest.advanceTimersByTime(TiempoRealChatsService.VENTANA_MS * 3);
    expect(ws.emitirAOrganizacion).toHaveBeenCalledTimes(2);
  });

  it('chats distintos no se bloquean entre sí', () => {
    const { servicio, ws } = fixture();
    servicio.notificar('org', 'chat-1', 'mensaje');
    servicio.notificar('org', 'chat-2', 'mensaje');
    servicio.notificar('otra-org', 'chat-1', 'mensaje');
    expect(ws.emitirAOrganizacion).toHaveBeenCalledTimes(3);
  });

  it('después de la ventana, un cambio nuevo vuelve a salir al instante', () => {
    const { servicio, ws } = fixture();
    servicio.notificar('org', 'chat-1', 'mensaje');
    jest.advanceTimersByTime(TiempoRealChatsService.VENTANA_MS);
    servicio.notificar('org', 'chat-1', 'mensaje');
    expect(ws.emitirAOrganizacion).toHaveBeenCalledTimes(2);
  });
});
