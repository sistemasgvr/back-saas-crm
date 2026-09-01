import {
  esEstadoTerminal,
  esReaperturaValida,
  esTransicionValida,
  estadoAlCambiarTipo,
  requiereTipoLeadDefinido,
  transicionesPermitidas,
} from './pipeline-inmobiliaria';

describe('pipeline-inmobiliaria — embudo COMPRA', () => {
  it('permite el camino feliz completo hasta cerrado ganado', () => {
    expect(esTransicionValida('COMPRA', 'NUEVO', 'CONTACTADO')).toBe(true);
    expect(esTransicionValida('COMPRA', 'CONTACTADO', 'CALIFICADO')).toBe(true);
    expect(esTransicionValida('COMPRA', 'CALIFICADO', 'VISITA_AGENDADA')).toBe(
      true,
    );
    expect(
      esTransicionValida('COMPRA', 'VISITA_AGENDADA', 'VISITA_REALIZADA'),
    ).toBe(true);
    expect(
      esTransicionValida('COMPRA', 'VISITA_REALIZADA', 'NEGOCIACION'),
    ).toBe(true);
    expect(esTransicionValida('COMPRA', 'NEGOCIACION', 'SEPARACION')).toBe(
      true,
    );
    expect(esTransicionValida('COMPRA', 'SEPARACION', 'CERRADO_GANADO')).toBe(
      true,
    );
  });

  it('permite saltar directo de CALIFICADO a NEGOCIACION (sin visitas)', () => {
    expect(esTransicionValida('COMPRA', 'CALIFICADO', 'NEGOCIACION')).toBe(
      true,
    );
  });

  it('permite retroceder de VISITA_REALIZADA a VISITA_AGENDADA (reagendar)', () => {
    expect(
      esTransicionValida('COMPRA', 'VISITA_REALIZADA', 'VISITA_AGENDADA'),
    ).toBe(true);
  });

  it('rechaza saltarse etapas (NUEVO directo a NEGOCIACION)', () => {
    expect(esTransicionValida('COMPRA', 'NUEVO', 'NEGOCIACION')).toBe(false);
  });

  it('rechaza CAPTACION y EN_COMERCIALIZACION (son de VENTA, no COMPRA)', () => {
    expect(transicionesPermitidas('COMPRA', 'CALIFICADO')).not.toContain(
      'CAPTACION',
    );
    expect(
      esTransicionValida('COMPRA', 'CALIFICADO', 'EN_COMERCIALIZACION'),
    ).toBe(false);
  });

  it('DESCARTADO siempre disponible desde cualquier estado no terminal', () => {
    for (const estado of [
      'NUEVO',
      'CONTACTADO',
      'CALIFICADO',
      'VISITA_AGENDADA',
      'VISITA_REALIZADA',
      'NEGOCIACION',
      'SEPARACION',
    ]) {
      expect(esTransicionValida('COMPRA', estado, 'DESCARTADO')).toBe(true);
    }
  });

  it('los estados terminales no tienen transiciones salientes', () => {
    expect(transicionesPermitidas('COMPRA', 'CERRADO_GANADO')).toEqual([]);
    expect(transicionesPermitidas('COMPRA', 'CERRADO_PERDIDO')).toEqual([]);
    expect(transicionesPermitidas('COMPRA', 'DESCARTADO')).toEqual([]);
  });
});

describe('pipeline-inmobiliaria — embudo VENTA', () => {
  it('permite el camino feliz completo hasta cerrado ganado', () => {
    expect(esTransicionValida('VENTA', 'NUEVO', 'CONTACTADO')).toBe(true);
    expect(esTransicionValida('VENTA', 'CONTACTADO', 'CALIFICADO')).toBe(true);
    expect(esTransicionValida('VENTA', 'CALIFICADO', 'CAPTACION')).toBe(true);
    expect(
      esTransicionValida('VENTA', 'CAPTACION', 'EN_COMERCIALIZACION'),
    ).toBe(true);
    expect(
      esTransicionValida('VENTA', 'EN_COMERCIALIZACION', 'NEGOCIACION'),
    ).toBe(true);
    expect(esTransicionValida('VENTA', 'NEGOCIACION', 'SEPARACION')).toBe(true);
    expect(esTransicionValida('VENTA', 'SEPARACION', 'CERRADO_GANADO')).toBe(
      true,
    );
  });

  it('rechaza VISITA_AGENDADA (es de COMPRA, no VENTA)', () => {
    expect(transicionesPermitidas('VENTA', 'CALIFICADO')).not.toContain(
      'VISITA_AGENDADA',
    );
    expect(esTransicionValida('VENTA', 'CALIFICADO', 'VISITA_AGENDADA')).toBe(
      false,
    );
  });

  it('EN_COMERCIALIZACION puede ir directo a NEGOCIACION o perderse/descartarse', () => {
    expect(
      esTransicionValida('VENTA', 'EN_COMERCIALIZACION', 'NEGOCIACION'),
    ).toBe(true);
    expect(
      esTransicionValida('VENTA', 'EN_COMERCIALIZACION', 'CERRADO_PERDIDO'),
    ).toBe(true);
    expect(
      esTransicionValida('VENTA', 'EN_COMERCIALIZACION', 'DESCARTADO'),
    ).toBe(true);
  });
});

describe('pipeline-inmobiliaria — embudo OTRO (y tipoLead null/undefined)', () => {
  it('es el embudo corto: NUEVO → CONTACTADO → CALIFICADO → terminal', () => {
    expect(esTransicionValida('OTRO', 'NUEVO', 'CONTACTADO')).toBe(true);
    expect(esTransicionValida('OTRO', 'CONTACTADO', 'CALIFICADO')).toBe(true);
    expect(esTransicionValida('OTRO', 'CALIFICADO', 'CERRADO_GANADO')).toBe(
      true,
    );
    expect(esTransicionValida('OTRO', 'CALIFICADO', 'CERRADO_PERDIDO')).toBe(
      true,
    );
  });

  it('no tiene VISITA_AGENDADA/CAPTACION/NEGOCIACION/SEPARACION', () => {
    expect(transicionesPermitidas('OTRO', 'CALIFICADO')).toEqual([
      'CERRADO_GANADO',
      'CERRADO_PERDIDO',
      'DESCARTADO',
    ]);
  });

  it('null/undefined se comporta igual que OTRO (embudo corto por defecto)', () => {
    expect(esTransicionValida(null, 'NUEVO', 'CONTACTADO')).toBe(true);
    expect(esTransicionValida(undefined, 'CONTACTADO', 'CALIFICADO')).toBe(
      true,
    );
    expect(transicionesPermitidas(null, 'CALIFICADO')).toEqual(
      transicionesPermitidas('OTRO', 'CALIFICADO'),
    );
  });
});

describe('requiereTipoLeadDefinido', () => {
  it('NUEVO, CONTACTADO y DESCARTADO no lo requieren', () => {
    expect(requiereTipoLeadDefinido('NUEVO')).toBe(false);
    expect(requiereTipoLeadDefinido('CONTACTADO')).toBe(false);
    expect(requiereTipoLeadDefinido('DESCARTADO')).toBe(false);
  });

  it('cualquier estado más avanzado sí lo requiere', () => {
    expect(requiereTipoLeadDefinido('CALIFICADO')).toBe(true);
    expect(requiereTipoLeadDefinido('NEGOCIACION')).toBe(true);
    expect(requiereTipoLeadDefinido('CERRADO_GANADO')).toBe(true);
  });
});

describe('esEstadoTerminal', () => {
  it('reconoce los 3 estados terminales', () => {
    expect(esEstadoTerminal('CERRADO_GANADO')).toBe(true);
    expect(esEstadoTerminal('CERRADO_PERDIDO')).toBe(true);
    expect(esEstadoTerminal('DESCARTADO')).toBe(true);
  });

  it('cualquier otro estado no es terminal', () => {
    expect(esEstadoTerminal('NEGOCIACION')).toBe(false);
    expect(esEstadoTerminal('NUEVO')).toBe(false);
  });
});

describe('esReaperturaValida', () => {
  it('permite reabrir un terminal hacia CONTACTADO o CALIFICADO', () => {
    expect(esReaperturaValida('CERRADO_PERDIDO', 'CONTACTADO')).toBe(true);
    expect(esReaperturaValida('DESCARTADO', 'CALIFICADO')).toBe(true);
  });

  it('rechaza reabrir hacia un estado que no sea de reapertura', () => {
    expect(esReaperturaValida('CERRADO_PERDIDO', 'NEGOCIACION')).toBe(false);
  });

  it('rechaza "reabrir" un estado que no es terminal', () => {
    expect(esReaperturaValida('CONTACTADO', 'CALIFICADO')).toBe(false);
  });
});

describe('estadoAlCambiarTipo (§4.1.5)', () => {
  it('conserva un estado común a los tres embudos', () => {
    expect(estadoAlCambiarTipo('NEGOCIACION')).toBe('NEGOCIACION');
    expect(estadoAlCambiarTipo('SEPARACION')).toBe('SEPARACION');
    expect(estadoAlCambiarTipo('CERRADO_GANADO')).toBe('CERRADO_GANADO');
  });

  it('resetea a CONTACTADO un estado exclusivo de un embudo', () => {
    expect(estadoAlCambiarTipo('VISITA_AGENDADA')).toBe('CONTACTADO');
    expect(estadoAlCambiarTipo('CAPTACION')).toBe('CONTACTADO');
    expect(estadoAlCambiarTipo('EN_COMERCIALIZACION')).toBe('CONTACTADO');
  });
});
