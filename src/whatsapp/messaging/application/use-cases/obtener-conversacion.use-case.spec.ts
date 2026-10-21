import { ObtenerConversacionUseCase } from './obtener-conversacion.use-case';

describe('Paginación del historial de mensajes', () => {
  const ctx = { usuarioId: 'asesor', rol: 'USUARIO' as const };
  function fixture(size: number) {
    const repository = {
      findPorId: jest
        .fn()
        .mockResolvedValue({ id: 'chat', lead: null, noLeidos: 1 }),
      listarMensajes: jest
        .fn()
        .mockResolvedValue(
          Array.from({ length: size }, (_, i) => ({ id: String(i) })),
        ),
      marcarLeida: jest.fn(),
    };
    const read = { execute: jest.fn().mockResolvedValue(undefined) };
    return {
      repository,
      read,
      useCase: new ObtenerConversacionUseCase(
        repository as never,
        read as never,
      ),
    };
  }

  it('devuelve los 200 recientes e informa si quedan mensajes anteriores', async () => {
    const { useCase, repository } = fixture(201);
    const result = await useCase.execute('org', 'chat', ctx);
    expect(repository.findPorId).toHaveBeenCalledWith('org', 'chat');
    expect(repository.listarMensajes).toHaveBeenCalledWith(
      'chat',
      201,
      undefined,
    );
    expect(result.mensajes).toHaveLength(200);
    expect(result.mensajes[0].id).toBe('1');
    expect(result.hayMensajesAnteriores).toBe(true);
  });

  it('carga páginas anteriores por cursor sin marcar mensajes nuevos como leídos', async () => {
    const { useCase, repository, read } = fixture(51);
    const result = await useCase.execute('org', 'chat', ctx, 'cursor');
    expect(repository.listarMensajes).toHaveBeenCalledWith(
      'chat',
      51,
      'cursor',
    );
    expect(result.mensajes).toHaveLength(50);
    expect(result.hayMensajesAnteriores).toBe(true);
    expect(repository.marcarLeida).not.toHaveBeenCalled();
    expect(read.execute).not.toHaveBeenCalled();
  });

  it('indica el final del historial', async () => {
    const { useCase } = fixture(12);
    const result = await useCase.execute('org', 'chat', ctx, 'cursor');
    expect(result.mensajes).toHaveLength(12);
    expect(result.hayMensajesAnteriores).toBe(false);
  });
});
