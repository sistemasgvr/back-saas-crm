/** Reglas de agenda de visitas (anti-solape + horario laboral). */

export const DURACION_VISITA_DEFAULT_MIN = 60;
export const DURACIONES_VISITA_PERMITIDAS = [30, 60, 90, 120, 180] as const;

export type DuracionVisitaMinutos = (typeof DURACIONES_VISITA_PERMITIDAS)[number];

export interface IntervaloVisita {
  inicio: Date;
  fin: Date;
}

/** true si [aInicio, aFin) se solapa con [bInicio, bFin). */
export function intervalosSeSolapan(
  a: IntervaloVisita,
  b: IntervaloVisita,
): boolean {
  return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime();
}

export function calcularProgramadaFin(
  programadaEn: Date,
  duracionMinutos: number,
): Date {
  return new Date(programadaEn.getTime() + duracionMinutos * 60_000);
}

export function normalizarDuracionMinutos(
  raw: string | number | null | undefined,
): DuracionVisitaMinutos {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if ((DURACIONES_VISITA_PERMITIDAS as readonly number[]).includes(n)) {
    return n as DuracionVisitaMinutos;
  }
  return DURACION_VISITA_DEFAULT_MIN;
}

/**
 * Horario laboral v1: Lun–Sáb 08:00–20:00 America/Lima.
 * La visita completa (inicio y fin) debe caer dentro del mismo día laboral.
 */
export function estaEnHorarioLaboral(
  inicio: Date,
  fin: Date,
  timeZone = 'America/Lima',
): boolean {
  const partes = (d: Date) => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const bag: Record<string, string> = {};
    for (const p of fmt.formatToParts(d)) {
      if (p.type !== 'literal') bag[p.type] = p.value;
    }
    return {
      weekday: bag.weekday,
      hour: Number(bag.hour),
      minute: Number(bag.minute),
      dayKey: `${bag.year}-${bag.month}-${bag.day}`,
    };
  };

  const a = partes(inicio);
  const b = partes(fin);
  if (a.dayKey !== b.dayKey) return false;
  if (a.weekday === 'Sun') return false;

  const minutosInicio = a.hour * 60 + a.minute;
  const minutosFin = b.hour * 60 + b.minute;
  const desde = 8 * 60;
  const hasta = 20 * 60;
  return minutosInicio >= desde && minutosFin <= hasta && minutosFin > minutosInicio;
}

/** Gracia de 5 minutos respecto a "ahora" para no rechazar el instante actual. */
export function esVisitaEnPasado(inicio: Date, ahora = new Date()): boolean {
  return inicio.getTime() < ahora.getTime() - 5 * 60_000;
}

export function mensajeSolapeVisita(): string {
  return 'El asesor ya tiene una visita programada que se solapa con ese horario';
}

export function mensajeHorarioLaboral(): string {
  return 'La visita debe agendarse de lunes a sábado entre 08:00 y 20:00 (hora Lima)';
}

export function mensajeVisitaPasado(): string {
  return 'No se puede agendar una visita en el pasado';
}
