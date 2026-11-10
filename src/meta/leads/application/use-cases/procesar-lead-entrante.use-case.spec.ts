import { ProcesarLeadEntranteUseCase } from './procesar-lead-entrante.use-case';

function fixture() {
  const paginas = {
    findActivaPorPageId: jest.fn().mockResolvedValue({
      id: 'pagina',
      organizacionId: 'org',
      pageId: 'meta-page',
      tokenPaginaCifrado: 'cifrado',
    }),
  };
  const graph = {
    obtenerLead: jest
      .fn()
      .mockResolvedValue({ campaignId: 'campana', formId: 'form' }),
  };
  const encryption = { decrypt: jest.fn().mockReturnValue('token') };
  const ingestar = {
    execute: jest.fn().mockResolvedValue({ leadId: 'lead', creado: true }),
  };
  const sources = {
    permitePagina: jest.fn().mockResolvedValue(true),
    permiteLead: jest.fn().mockResolvedValue(true),
  };
  type Args = ConstructorParameters<typeof ProcesarLeadEntranteUseCase>;
  const caso = new ProcesarLeadEntranteUseCase(
    paginas as unknown as Args[0],
    graph as unknown as Args[1],
    encryption as unknown as Args[2],
    ingestar as unknown as Args[3],
    sources as unknown as Args[4],
  );
  return { caso, graph, ingestar, sources };
}

describe('Webhook respeta la selección de importación', () => {
  it('no consulta Meta ni crea leads si la página está desactivada', async () => {
    const { caso, graph, ingestar, sources } = fixture();
    sources.permitePagina.mockResolvedValue(false);
    expect((await caso.execute('meta-page', 'meta-lead')).procesado).toBe(
      false,
    );
    expect(graph.obtenerLead).not.toHaveBeenCalled();
    expect(ingestar.execute).not.toHaveBeenCalled();
  });

  it('no ingesta si la campaña o el formulario está desactivado', async () => {
    const { caso, ingestar, sources } = fixture();
    sources.permiteLead.mockResolvedValue(false);
    expect((await caso.execute('meta-page', 'meta-lead')).procesado).toBe(
      false,
    );
    expect(ingestar.execute).not.toHaveBeenCalled();
  });

  it('importa normalmente cuando los orígenes están habilitados', async () => {
    const { caso, ingestar } = fixture();
    expect(await caso.execute('meta-page', 'meta-lead')).toMatchObject({
      procesado: true,
      leadId: 'lead',
      creado: true,
    });
    expect(ingestar.execute).toHaveBeenCalledTimes(1);
  });
});
