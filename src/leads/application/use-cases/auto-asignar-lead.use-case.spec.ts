import { AutoAsignarLeadUseCase } from './auto-asignar-lead.use-case';

describe('AutoAsignarLeadUseCase', () => {
  it('retorna null si el lead no existe', async () => {
    const repo: any = {
      obtenerLeadParaAutoAsignacion: jest.fn().mockResolvedValue(null),
      obtenerConfig: jest.fn(),
      encolarLead: jest.fn(),
      procesarCola: jest.fn(),
    };

    const useCase = new AutoAsignarLeadUseCase(repo);
    const res = await useCase.execute('org1', 'lead1');

    expect(res).toEqual({ asignadoUsuarioId: null, fueAutoAsignado: false });
    expect(repo.encolarLead).not.toHaveBeenCalled();
    expect(repo.procesarCola).not.toHaveBeenCalled();
  });

  it('no hace nada si el lead ya tiene asignadoUsuarioId', async () => {
    const repo: any = {
      obtenerLeadParaAutoAsignacion: jest
        .fn()
        .mockResolvedValueOnce({ asignadoUsuarioId: 'u1', fechaLeadEfectiva: new Date() }),
      obtenerConfig: jest.fn(),
      encolarLead: jest.fn(),
      procesarCola: jest.fn(),
    };

    const useCase = new AutoAsignarLeadUseCase(repo);
    const res = await useCase.execute('org1', 'lead1');

    expect(res).toEqual({ asignadoUsuarioId: 'u1', fueAutoAsignado: false });
    expect(repo.obtenerConfig).not.toHaveBeenCalled();
    expect(repo.encolarLead).not.toHaveBeenCalled();
    expect(repo.procesarCola).not.toHaveBeenCalled();
  });

  it('no auto-asigna si la config está deshabilitada', async () => {
    const repo: any = {
      obtenerLeadParaAutoAsignacion: jest.fn().mockResolvedValueOnce({
        asignadoUsuarioId: null,
        fechaLeadEfectiva: new Date('2026-01-01T00:00:00.000Z'),
      }),
      obtenerConfig: jest.fn().mockResolvedValueOnce({
        habilitado: false,
        usuarioIds: ['u1', 'u2'],
        siguienteIndice: 0,
      }),
      encolarLead: jest.fn(),
      procesarCola: jest.fn(),
    };

    const useCase = new AutoAsignarLeadUseCase(repo);
    const res = await useCase.execute('org1', 'lead1');

    expect(res).toEqual({ asignadoUsuarioId: null, fueAutoAsignado: false });
    expect(repo.encolarLead).not.toHaveBeenCalled();
    expect(repo.procesarCola).not.toHaveBeenCalled();
  });

  it('auto-asigna en camino feliz y devuelve el usuario asignado', async () => {
    const fechaLead = new Date('2026-01-01T00:00:00.000Z');
    const repo: any = {
      obtenerLeadParaAutoAsignacion: jest
        .fn()
        .mockResolvedValueOnce({ asignadoUsuarioId: null, fechaLeadEfectiva: fechaLead })
        .mockResolvedValueOnce({ asignadoUsuarioId: 'u2', fechaLeadEfectiva: fechaLead }),
      obtenerConfig: jest.fn().mockResolvedValueOnce({
        habilitado: true,
        usuarioIds: ['u1', 'u2'],
        siguienteIndice: 0,
      }),
      encolarLead: jest.fn().mockResolvedValue(undefined),
      procesarCola: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new AutoAsignarLeadUseCase(repo);
    const res = await useCase.execute('org1', 'lead1');

    expect(repo.encolarLead).toHaveBeenCalledWith({
      organizacionId: 'org1',
      leadId: 'lead1',
      fechaLead: fechaLead,
    });
    expect(repo.procesarCola).toHaveBeenCalledWith('org1');
    expect(res).toEqual({ asignadoUsuarioId: 'u2', fueAutoAsignado: true });
  });
});

