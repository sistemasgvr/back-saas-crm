import {
  rankearInteresados,
  type LeadRankingInput,
} from './ranking-interesados';

function lead(
  partial: Partial<LeadRankingInput> & { id: string },
): LeadRankingInput {
  return {
    nombre: 'Lead',
    telefono: null,
    estadoGestion: 'NUEVO',
    tipoLead: 'COMPRA',
    estadoGestionEn: new Date('2026-09-01T12:00:00Z'),
    interesExplicito: false,
    visitas: [],
    ...partial,
  };
}

describe('rankearInteresados', () => {
  const ahora = new Date('2026-09-04T12:00:00Z');

  it('prioriza interés explícito + etapa avanzada sobre solo visita', () => {
    const ranked = rankearInteresados(
      [
        lead({
          id: 'visita',
          nombre: 'Solo visita',
          estadoGestion: 'CONTACTADO',
          visitas: [
            {
              estado: 'PROGRAMADA',
              programadaEn: ahora,
              fechaModificacion: ahora,
            },
          ],
        }),
        lead({
          id: 'interes',
          nombre: 'Interés + separación',
          estadoGestion: 'SEPARACION',
          interesExplicito: true,
          tipoLead: 'COMPRA',
        }),
      ],
      'VENTA',
      ahora,
    );

    expect(ranked[0].id).toBe('interes');
    expect(ranked[0].origen).toBe('interes');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('boostea visitas realizadas más que agendadas', () => {
    const ranked = rankearInteresados(
      [
        lead({
          id: 'agendada',
          nombre: 'Agendada',
          estadoGestion: 'VISITA_AGENDADA',
          visitas: [
            {
              estado: 'PROGRAMADA',
              programadaEn: ahora,
              fechaModificacion: ahora,
            },
          ],
        }),
        lead({
          id: 'realizada',
          nombre: 'Realizada',
          estadoGestion: 'VISITA_REALIZADA',
          visitas: [
            {
              estado: 'REALIZADA',
              programadaEn: ahora,
              fechaModificacion: ahora,
            },
          ],
        }),
      ],
      'VENTA',
      ahora,
    );

    expect(ranked[0].id).toBe('realizada');
  });

  it('pone terminales perdidos/descartados al final', () => {
    const ranked = rankearInteresados(
      [
        lead({
          id: 'perdido',
          nombre: 'Perdido',
          estadoGestion: 'CERRADO_PERDIDO',
          interesExplicito: true,
        }),
        lead({
          id: 'nuevo',
          nombre: 'Nuevo',
          estadoGestion: 'NUEVO',
          interesExplicito: true,
        }),
      ],
      'VENTA',
      ahora,
    );

    expect(ranked[0].id).toBe('nuevo');
    expect(ranked[1].id).toBe('perdido');
  });

  it('marca origen ambos cuando hay interés y visita', () => {
    const ranked = rankearInteresados(
      [
        lead({
          id: 'ambos',
          interesExplicito: true,
          visitas: [
            {
              estado: 'REALIZADA',
              programadaEn: ahora,
              fechaModificacion: ahora,
            },
          ],
        }),
      ],
      'VENTA',
      ahora,
    );

    expect(ranked[0].origen).toBe('ambos');
  });
});
