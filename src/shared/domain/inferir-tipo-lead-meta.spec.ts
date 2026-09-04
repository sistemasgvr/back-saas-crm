import { inferirTipoLeadDesdeFieldData } from './inferir-tipo-lead-meta';

describe('inferirTipoLeadDesdeFieldData', () => {
  it('infiere COMPRA desde respuesta del formulario', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        { name: 'full_name', values: ['Ana'] },
        { name: 'interes', values: ['Quiero comprar un departamento'] },
      ]),
    ).toBe('COMPRA');
  });

  it('infiere VENTA desde respuesta del formulario', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        {
          name: 'que_buscas',
          label: '¿Qué necesitas?',
          values: ['Vender mi casa'],
        },
      ]),
    ).toBe('VENTA');
  });

  it('infiere COMPRA si el keyword está en el nombre del campo', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        { name: 'presupuesto_compra', values: ['150000'] },
      ]),
    ).toBe('COMPRA');
  });

  it('infiere VENTA desde question/label sin values fuertes', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        {
          name: 'q1',
          question: '¿Quieres poner en venta tu inmueble?',
          values: ['Sí'],
        },
      ]),
    ).toBe('VENTA');
  });

  it('reconoce buyer / seller en inglés', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        { name: 'intent', values: ['Looking to buy'] },
      ]),
    ).toBe('COMPRA');
    expect(
      inferirTipoLeadDesdeFieldData([
        { name: 'intent', values: ['Want to sell'] },
      ]),
    ).toBe('VENTA');
  });

  it('devuelve null si no hay señales', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        { name: 'email', values: ['a@b.com'] },
        { name: 'phone_number', values: ['999'] },
      ]),
    ).toBeNull();
  });

  it('devuelve null si COMPRA y VENTA empatan', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        { name: 'interes', values: ['Compra o venta'] },
      ]),
    ).toBeNull();
  });

  it('devuelve null con lista vacía o undefined', () => {
    expect(inferirTipoLeadDesdeFieldData([])).toBeNull();
    expect(inferirTipoLeadDesdeFieldData(undefined)).toBeNull();
    expect(inferirTipoLeadDesdeFieldData(null)).toBeNull();
  });

  it('normaliza acentos y guiones', () => {
    expect(
      inferirTipoLeadDesdeFieldData([
        { name: 'motivo', values: ['Captación de propietario'] },
      ]),
    ).toBe('VENTA');
  });
});
