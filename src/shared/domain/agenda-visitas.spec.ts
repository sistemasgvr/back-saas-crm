import {
  calcularProgramadaFin,
  estaEnHorarioLaboral,
  esVisitaEnPasado,
  intervalosSeSolapan,
  mensajeHorarioLaboral,
  mensajeSolapeVisita,
  mensajeVisitaPasado,
  normalizarDuracionMinutos,
  type IntervaloVisita,
} from './agenda-visitas';

describe('agenda-visitas', () => {
  describe('intervalosSeSolapan', () => {
    const slot = (h1: number, m1: number, h2: number, m2: number): IntervaloVisita => ({
      inicio: new Date(Date.UTC(2026, 8, 3, h1, m1)),
      fin: new Date(Date.UTC(2026, 8, 3, h2, m2)),
    });

    it('detecta solape parcial', () => {
      expect(intervalosSeSolapan(slot(10, 0, 11, 0), slot(10, 30, 11, 30))).toBe(true);
    });

    it('no solapa si son contiguos', () => {
      expect(intervalosSeSolapan(slot(10, 0, 11, 0), slot(11, 0, 12, 0))).toBe(false);
    });

    it('no solapa si están separados', () => {
      expect(intervalosSeSolapan(slot(10, 0, 11, 0), slot(12, 0, 13, 0))).toBe(false);
    });
  });

  describe('calcularProgramadaFin', () => {
    it('suma minutos', () => {
      const inicio = new Date('2026-09-03T15:00:00.000Z');
      expect(calcularProgramadaFin(inicio, 60).toISOString()).toBe(
        '2026-09-03T16:00:00.000Z',
      );
    });
  });

  describe('normalizarDuracionMinutos', () => {
    it('acepta valores permitidos', () => {
      expect(normalizarDuracionMinutos(90)).toBe(90);
      expect(normalizarDuracionMinutos('30')).toBe(30);
    });

    it('cae a 60 si es inválido', () => {
      expect(normalizarDuracionMinutos(45)).toBe(60);
      expect(normalizarDuracionMinutos(undefined)).toBe(60);
    });
  });

  describe('estaEnHorarioLaboral', () => {
    it('acepta visita dentro de Lun–Sáb 08–20 Lima', () => {
      // 2026-09-03 es jueves; 15:00–16:00 UTC = 10:00–11:00 Lima (UTC-5)
      const inicio = new Date('2026-09-03T15:00:00.000Z');
      const fin = new Date('2026-09-03T16:00:00.000Z');
      expect(estaEnHorarioLaboral(inicio, fin)).toBe(true);
    });

    it('rechaza domingo', () => {
      // 2026-09-06 domingo; 15:00 UTC = 10:00 Lima
      const inicio = new Date('2026-09-06T15:00:00.000Z');
      const fin = new Date('2026-09-06T16:00:00.000Z');
      expect(estaEnHorarioLaboral(inicio, fin)).toBe(false);
    });
  });

  describe('esVisitaEnPasado', () => {
    it('rechaza hace más de 5 minutos', () => {
      const ahora = new Date('2026-09-03T12:00:00.000Z');
      const inicio = new Date('2026-09-03T11:50:00.000Z');
      expect(esVisitaEnPasado(inicio, ahora)).toBe(true);
    });

    it('permite con gracia de 5 minutos', () => {
      const ahora = new Date('2026-09-03T12:00:00.000Z');
      const inicio = new Date('2026-09-03T11:56:00.000Z');
      expect(esVisitaEnPasado(inicio, ahora)).toBe(false);
    });
  });

  it('mensajes legibles', () => {
    expect(mensajeSolapeVisita()).toMatch(/solapa/i);
    expect(mensajeHorarioLaboral()).toMatch(/08:00/);
    expect(mensajeVisitaPasado()).toMatch(/pasado/i);
  });
});
