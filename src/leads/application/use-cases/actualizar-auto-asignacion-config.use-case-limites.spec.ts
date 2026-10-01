import { ActualizarAutoAsignacionConfigUseCase } from './actualizar-auto-asignacion-config.use-case';
import type { LeadAutoAsignacionRepository } from '../ports/lead-auto-asignacion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

describe('Validación de configuración automática', () => {
  const repo = { actualizarConfig: jest.fn() };
  const leads = { esMiembroActivo: jest.fn().mockResolvedValue(true) };
  const useCase = new ActualizarAutoAsignacionConfigUseCase(
    repo as unknown as LeadAutoAsignacionRepository,
    leads as unknown as LeadsGestionRepository,
  );
  it('acepta un usuario', async () => {
    await expect(
      useCase.execute('org', {
        habilitado: true,
        usuarioIds: ['u1'],
        limitesDiarios: { u1: 3 },
      }),
    ).resolves.toBeUndefined();
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rechaza límite inválido %s',
    async (limite) => {
      await expect(
        useCase.execute('org', {
          habilitado: true,
          usuarioIds: ['u1'],
          limitesDiarios: { u1: limite },
        }),
      ).rejects.toThrow();
    },
  );
  it('rechaza límites de usuarios ajenos a la lista y listas vacías activas', async () => {
    await expect(
      useCase.execute('org', {
        habilitado: true,
        usuarioIds: ['u1'],
        limitesDiarios: { u2: 3 },
      }),
    ).rejects.toThrow();
    await expect(
      useCase.execute('org', { habilitado: true, usuarioIds: [] }),
    ).rejects.toThrow();
  });
});
