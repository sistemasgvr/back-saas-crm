import { ForbiddenException } from '@nestjs/common';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import { ListarConversacionesUseCase } from './listar-conversaciones.use-case';
import { ObtenerConversacionUseCase } from './obtener-conversacion.use-case';
import type { MarcarLeidoWhatsAppUseCase } from './marcar-leido-whatsapp.use-case';

describe('Visibilidad de chats de WhatsApp', () => {
  const asesor = {
    usuarioId: 'asesor-a',
    rol: 'USUARIO' as const,
    permisos: ['chats.ver'],
  };
  const equipo = {
    ...asesor,
    permisos: [...asesor.permisos, 'chats.ver_todos'],
  };
  const findPorId = jest.fn();
  const listarMensajes = jest.fn().mockResolvedValue([]);
  const listar = jest.fn();
  const conversaciones = {
    findPorId,
    listarMensajes,
    listar,
  } as unknown as WhatsappConversacionesRepository;
  const detalle = new ObtenerConversacionUseCase(
    conversaciones,
    {} as MarcarLeidoWhatsAppUseCase,
  );

  beforeEach(() => jest.clearAllMocks());

  it('bloquea el historial ajeno antes de consultar mensajes', async () => {
    findPorId.mockResolvedValue({ lead: { asignadoUsuarioId: 'asesor-b' } });
    await expect(detalle.execute('org', 'chat', asesor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(listarMensajes).not.toHaveBeenCalled();
    await expect(detalle.execute('org', 'chat', equipo)).resolves.toMatchObject(
      {
        mensajes: [],
      },
    );
  });

  it.each([
    null,
    { asignadoUsuarioId: null },
    { asignadoUsuarioId: 'asesor-a' },
  ])('permite leer un chat propio o libre (%p)', async (lead) => {
    findPorId.mockResolvedValue({ lead });
    await expect(detalle.execute('org', 'chat', asesor)).resolves.toMatchObject(
      {
        mensajes: [],
      },
    );
  });

  it('aplica el alcance del rol a la lista y conserva el filtro Míos', () => {
    const bandeja = new ListarConversacionesUseCase(conversaciones);
    bandeja.execute('org', asesor, { q: 'texto' });
    bandeja.execute('org', equipo);
    bandeja.execute('org', equipo, { asignado: 'mios' });
    expect(listar.mock.calls.map(([, filtro]) => filtro)).toEqual([
      { modo: 'usuario_y_libres', usuarioId: asesor.usuarioId },
      { modo: 'todos' },
      { modo: 'usuario', usuarioId: asesor.usuarioId },
    ]);
  });
});
