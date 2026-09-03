import { BadRequestException } from '@nestjs/common';
import { ActualizarAutoAsignacionConfigUseCase } from './actualizar-auto-asignacion-config.use-case';

describe('ActualizarAutoAsignacionConfigUseCase', () => {
  it('falla si hay usuarios duplicados', async () => {
    const repo: any = { actualizarConfig: jest.fn() };
    const leads: any = { esMiembroActivo: jest.fn() };
    const useCase = new ActualizarAutoAsignacionConfigUseCase(repo, leads);

    await expect(
      useCase.execute('org1', {
        habilitado: true,
        usuarioIds: ['u1', 'u1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.actualizarConfig).not.toHaveBeenCalled();
  });

  it('falla si habilitado=true y alguno no es miembro activo', async () => {
    const repo: any = { actualizarConfig: jest.fn() };
    const leads: any = {
      esMiembroActivo: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    };
    const useCase = new ActualizarAutoAsignacionConfigUseCase(repo, leads);

    await expect(
      useCase.execute('org1', {
        habilitado: true,
        usuarioIds: ['u1', 'u2'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.actualizarConfig).not.toHaveBeenCalled();
  });

  it('actualiza config si habilitado=false (sin validar membresías)', async () => {
    const repo: any = { actualizarConfig: jest.fn().mockResolvedValue(undefined) };
    const leads: any = { esMiembroActivo: jest.fn() };
    const useCase = new ActualizarAutoAsignacionConfigUseCase(repo, leads);

    await useCase.execute('org1', {
      habilitado: false,
      usuarioIds: ['u1', 'u2'],
    });

    expect(leads.esMiembroActivo).not.toHaveBeenCalled();
    expect(repo.actualizarConfig).toHaveBeenCalledWith({
      organizacionId: 'org1',
      habilitado: false,
      usuarioIds: ['u1', 'u2'],
    });
  });
});

