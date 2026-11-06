import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { LeadSourcesService } from './lead-sources.service';

function fixture() {
  const prisma = {
    metaPagina: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ importarLeadsAutomaticamente: true }),
      updateMany: jest.fn(),
    },
    campana: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ importarLeadsAutomaticamente: true, estado: 1 }),
      updateMany: jest.fn(),
    },
    metaFormulario: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ importarLeadsAutomaticamente: true }),
      updateMany: jest.fn(),
    },
  };
  return {
    prisma,
    service: new LeadSourcesService(prisma as unknown as PrismaService),
  };
}

describe('Selección de orígenes de leads automáticos', () => {
  const lead = { campaignId: 'meta-campana', formId: 'meta-form' };

  it('permite leads cuando todos los orígenes están habilitados', async () => {
    const { service } = fixture();
    expect(await service.permiteLead('org', 'pagina', lead)).toBe(true);
  });

  it.each(['metaPagina', 'campana', 'metaFormulario'] as const)(
    'bloquea si %s está desactivado',
    async (tipo) => {
      const { service, prisma } = fixture();
      prisma[tipo].findFirst.mockResolvedValue({
        importarLeadsAutomaticamente: false,
        estado: 1,
      });
      expect(await service.permiteLead('org', 'pagina', lead)).toBe(false);
    },
  );

  it('mantiene la entrada de formularios y campañas todavía no sincronizados', async () => {
    const { service, prisma } = fixture();
    prisma.campana.findFirst.mockResolvedValue(null);
    prisma.metaFormulario.findFirst.mockResolvedValue(null);
    expect(await service.permiteLead('org', 'pagina', lead)).toBe(true);
    expect(prisma.metaFormulario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizacionId: 'org',
          metaPaginaId: 'pagina',
          formId: 'meta-form',
          estado: 1,
        },
      }),
    );
  });

  it('no permite cambiar un origen ajeno a la organización', async () => {
    const { service, prisma } = fixture();
    prisma.campana.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.actualizar('org', 'campanas', 'ajena', false, 'usuario'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.campana.updateMany).toHaveBeenCalledWith({
      where: { id: 'ajena', organizacionId: 'org', estado: 1 },
      data: { importarLeadsAutomaticamente: false, usuarioEdicion: 'usuario' },
    });
  });
});
