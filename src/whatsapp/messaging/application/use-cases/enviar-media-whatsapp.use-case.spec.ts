import { EnviarMediaWhatsAppUseCase } from './enviar-media-whatsapp.use-case';

function preparar() {
  const conversaciones = {
    findPorId: jest.fn().mockResolvedValue({
      whatsappConexionId: 'wa',
      lead: null,
      waId: '51999999999',
      ventanaExpiraEn: new Date(Date.now() + 60_000),
    }),
    registrarMensaje: jest.fn().mockResolvedValue(undefined),
  };
  const graph = {
    subirMediaWhatsApp: jest.fn().mockResolvedValue({ mediaId: 'media' }),
    enviarMediaWhatsApp: jest.fn().mockResolvedValue({ wamid: 'mensaje' }),
  };
  const guardar = { asegurar: jest.fn().mockResolvedValue({ id: 'objeto' }) };
  const comprimido = {
    buffer: Buffer.from('video comprimido'),
    mimeType: 'video/mp4',
    nombreArchivo: 'video.mp4',
  };
  const compresor = { comprimir: jest.fn().mockResolvedValue(comprimido) };
  const service = new EnviarMediaWhatsAppUseCase(
    {
      despachar: jest.fn(
        (
          _org: string,
          _chat: string,
          _ctx: unknown,
          _accion: string,
          enviar: () => Promise<{ wamid: string }>,
        ) => enviar(),
      ),
    } as never,
    conversaciones as never,
    {
      findPorId: jest
        .fn()
        .mockResolvedValue({ metaConexionId: 'meta', phoneNumberId: 'numero' }),
    } as never,
    {
      findActivaPorId: jest
        .fn()
        .mockResolvedValue({ id: 'meta', tokenCifrado: 'cifrado' }),
    } as never,
    graph as never,
    { decrypt: jest.fn().mockReturnValue('token-prueba') } as never,
    guardar as never,
    compresor as never,
  );
  return { service, conversaciones, graph, guardar, compresor, comprimido };
}

const ctx = { usuarioId: 'asesor', rol: 'USUARIO' as const };
const input = {
  buffer: Buffer.alloc(17 * 1024 ** 2),
  mimeType: 'video/quicktime',
  nombreArchivo: 'video.mov',
  caption: 'Recorrido',
};

it('envía a Meta y guarda en el historial los mismos bytes, MIME y nombre comprimidos', async () => {
  const { service, graph, guardar, conversaciones, compresor, comprimido } =
    preparar();
  await service.execute('org', 'chat', input, ctx);
  expect(compresor.comprimir).toHaveBeenCalledWith(input);
  expect(graph.subirMediaWhatsApp).toHaveBeenCalledWith(
    'numero',
    'token-prueba',
    comprimido.buffer,
    'video/mp4',
    'video.mp4',
  );
  expect(guardar.asegurar).toHaveBeenCalledWith(
    'org',
    comprimido.buffer,
    'video/mp4',
  );
  expect(conversaciones.registrarMensaje).toHaveBeenCalledWith(
    expect.objectContaining({
      tipo: 'video',
      mediaMimeType: 'video/mp4',
      mediaNombreArchivo: 'video.mp4',
      mediaTamanoBytes: comprimido.buffer.length,
      mediaCaption: 'Recorrido',
    }),
  );
});

it('no comprime ni sube archivos cuando la conversación no está autorizada', async () => {
  const { service, conversaciones, compresor, graph } = preparar();
  conversaciones.findPorId.mockResolvedValue(null);
  await expect(service.execute('org', 'chat', input, ctx)).rejects.toThrow(
    /no encontrada/,
  );
  expect(compresor.comprimir).not.toHaveBeenCalled();
  expect(graph.subirMediaWhatsApp).not.toHaveBeenCalled();
});

it('no contacta Meta cuando la compresión falla o todavía supera el límite', async () => {
  const { service, compresor, graph } = preparar();
  compresor.comprimir.mockResolvedValue({ ...input, mimeType: 'video/mp4' });
  await expect(service.execute('org', 'chat', input, ctx)).rejects.toThrow(
    /16 MB/,
  );
  expect(graph.subirMediaWhatsApp).not.toHaveBeenCalled();
});
