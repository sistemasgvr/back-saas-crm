import {
  camposAlEntrarEstado,
  requiereFormularioTransicion,
  validarTransicionPipeline,
} from './campos-transicion-pipeline';

describe('campos-transicion-pipeline', () => {
  describe('camposAlEntrarEstado — COMPRA', () => {
    it('exige fecha e inmueble al agendar visita', () => {
      const campos = camposAlEntrarEstado('COMPRA', 'VISITA_AGENDADA');
      const codigos = campos.map((c) => c.codigo);
      expect(codigos).toContain('visitaProgramadaEn');
      expect(codigos).toContain('referenciaInmueble');
      expect(
        campos.find((c) => c.codigo === 'visitaProgramadaEn')?.requerido,
      ).toBe(true);
    });

    it('exige resultado y nota al marcar visita realizada', () => {
      const campos = camposAlEntrarEstado('COMPRA', 'VISITA_REALIZADA');
      expect(campos.find((c) => c.codigo === 'resultadoVisita')?.requerido).toBe(
        true,
      );
      expect(campos.find((c) => c.codigo === 'notaTransicion')?.requerido).toBe(
        true,
      );
    });

    it('exige nota al calificar', () => {
      const campos = camposAlEntrarEstado('COMPRA', 'CALIFICADO');
      expect(campos.find((c) => c.codigo === 'notaTransicion')?.requerido).toBe(
        true,
      );
    });
  });

  describe('validarTransicionPipeline', () => {
    it('rechaza visita agendada sin fecha', () => {
      const r = validarTransicionPipeline('COMPRA', 'VISITA_AGENDADA', {
        metadata: { referenciaInmueble: 'Proyecto Sol' },
      });
      expect(r.valido).toBe(false);
      expect(r.errores.some((e) => e.includes('Fecha'))).toBe(true);
    });

    it('acepta visita agendada con datos completos', () => {
      const r = validarTransicionPipeline('COMPRA', 'VISITA_AGENDADA', {
        metadata: {
          visitaProgramadaEn: '2026-09-15T11:00:00.000Z',
          referenciaInmueble: 'Proyecto Sol',
          modalidadVisita: 'PRESENCIAL',
        },
      });
      expect(r.valido).toBe(true);
    });

    it('rechaza calificado sin nota', () => {
      const r = validarTransicionPipeline('COMPRA', 'CALIFICADO', {
        metadata: { zona: 'Miraflores' },
      });
      expect(r.valido).toBe(false);
    });

    it('rechaza metadata con claves no permitidas', () => {
      const r = validarTransicionPipeline('COMPRA', 'CALIFICADO', {
        notaTransicion: 'Cliente interesado',
        metadata: { campoRaro: 'x' },
      });
      expect(r.valido).toBe(false);
    });
  });

  describe('requiereFormularioTransicion', () => {
    it('contactado no obliga formulario (solo campos opcionales)', () => {
      expect(requiereFormularioTransicion('COMPRA', 'CONTACTADO')).toBe(false);
    });

    it('calificado sí obliga formulario', () => {
      expect(requiereFormularioTransicion('COMPRA', 'CALIFICADO')).toBe(true);
    });
  });
});
