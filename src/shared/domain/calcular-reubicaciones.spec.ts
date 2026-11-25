import {
  calcularReubicaciones,
  parsePipelineConfig,
  pipelineConfigPorDefecto,
  validarPipelineConfig,
} from './pipeline-inmobiliaria';

describe('validarPipelineConfig — etapas sin salida', () => {
  function conEtapaSinSalida() {
    const c = pipelineConfigPorDefecto();
    c.COMPRA.estados.splice(1, 0, 'HUERFANA');
    c.COMPRA.transiciones.HUERFANA = [];
    return c;
  }

  it('al guardar (estricto) rechaza una etapa no terminal sin salidas', () => {
    expect(() => validarPipelineConfig(conEtapaSinSalida(), true)).toThrow(
      /al menos una salida/,
    );
  });

  it('al leer una config ya guardada no la descarta', () => {
    expect(parsePipelineConfig(conEtapaSinSalida())).not.toBeNull();
  });

  it('los valores por defecto pasan el modo estricto', () => {
    expect(() =>
      validarPipelineConfig(pipelineConfigPorDefecto(), true),
    ).not.toThrow();
  });
});

describe('calcularReubicaciones', () => {
  function sin(estados: string[]) {
    const nuevo = pipelineConfigPorDefecto();
    nuevo.COMPRA.estados = nuevo.COMPRA.estados.filter(
      (e) => !estados.includes(e),
    );
    return nuevo;
  }

  it('sin cambios no reubica nada', () => {
    const base = pipelineConfigPorDefecto();
    expect(calcularReubicaciones(base, pipelineConfigPorDefecto())).toEqual([]);
  });

  it('un estado quitado retrocede al anterior de la lista', () => {
    expect(
      calcularReubicaciones(pipelineConfigPorDefecto(), sin(['CONTACTADO'])),
    ).toEqual([{ tipoLead: 'COMPRA', desde: 'CONTACTADO', hacia: 'NUEVO' }]);
  });

  it('si el anterior también se quitó, usa el más cercano vigente', () => {
    const r = calcularReubicaciones(
      pipelineConfigPorDefecto(),
      sin(['VISITA_AGENDADA', 'VISITA_REALIZADA']),
    );
    expect(r).toEqual([
      { tipoLead: 'COMPRA', desde: 'VISITA_AGENDADA', hacia: 'CALIFICADO' },
      { tipoLead: 'COMPRA', desde: 'VISITA_REALIZADA', hacia: 'CALIFICADO' },
    ]);
  });

  it('solo afecta al embudo donde se quitó', () => {
    const r = calcularReubicaciones(
      pipelineConfigPorDefecto(),
      sin(['VISITA_AGENDADA']),
    );
    expect(r.every((x) => x.tipoLead === 'COMPRA')).toBe(true);
  });
});
