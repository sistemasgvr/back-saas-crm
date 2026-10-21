import { dependenciasDe, dependientesActivos } from './modulos-dependencias';

const catalogo = [
  { codigo: 'LEADS', requiere: [] },
  { codigo: 'WHATSAPP', requiere: ['LEADS'] },
  { codigo: 'META_LEADS', requiere: ['LEADS'] },
  { codigo: 'AUTOMATIZACIONES', requiere: ['WHATSAPP'] },
];
describe('Dependencias de módulos', () => {
  it('resuelve transitivamente en orden y sin duplicados', () => {
    expect(dependenciasDe('AUTOMATIZACIONES', catalogo)).toEqual([
      'LEADS',
      'WHATSAPP',
    ]);
    expect(dependenciasDe('LEADS', catalogo)).toEqual([]);
  });
  it('encuentra solo dependientes activos, incluso indirectos', () => {
    expect(
      dependientesActivos(
        'LEADS',
        ['LEADS', 'AUTOMATIZACIONES', 'META_LEADS'],
        catalogo,
      ),
    ).toEqual(['AUTOMATIZACIONES', 'META_LEADS']);
  });
  it('rechaza referencias inexistentes y ciclos directos e indirectos', () => {
    expect(() => dependenciasDe('OTRO', catalogo)).toThrow('inexistente');
    expect(() =>
      dependenciasDe('A', [{ codigo: 'A', requiere: ['A'] }]),
    ).toThrow('circular');
    expect(() =>
      dependenciasDe('A', [
        { codigo: 'A', requiere: ['B'] },
        { codigo: 'B', requiere: ['A'] },
      ]),
    ).toThrow('circular');
  });
  it('resuelve un grafo con una dependencia compartida', () => {
    expect(
      dependenciasDe('PACK', [
        ...catalogo,
        { codigo: 'PACK', requiere: ['META_LEADS', 'WHATSAPP'] },
      ]),
    ).toEqual(['LEADS', 'META_LEADS', 'WHATSAPP']);
  });
});
