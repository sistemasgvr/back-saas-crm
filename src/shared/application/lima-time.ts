// America/Lima es UTC-5 fijo, sin horario de verano (PLAN.md §3.12), por lo
// que basta un offset constante — no hace falta una librería de timezones.

const FORMATTER_LIMA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parseFecha(fechaYYYYMMDD: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = fechaYYYYMMDD.split('-').map(Number);
  return { year, month, day };
}

function formatFecha(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Instante UTC de las 00:00:00.000 en Lima para un día calendario "YYYY-MM-DD". */
export function inicioDiaLimaUtc(fechaYYYYMMDD: string): Date {
  return new Date(`${fechaYYYYMMDD}T00:00:00.000-05:00`);
}

/** Instante UTC de las 23:59:59.999 en Lima para un día calendario "YYYY-MM-DD". */
export function finDiaLimaUtc(fechaYYYYMMDD: string): Date {
  return new Date(`${fechaYYYYMMDD}T23:59:59.999-05:00`);
}

/** Fecha calendario ("YYYY-MM-DD") de un instante, interpretada en Lima. Por defecto: ahora mismo. */
export function fechaLima(instante: Date = new Date()): string {
  return FORMATTER_LIMA.format(instante);
}

/** Día calendario "YYYY-MM-DD" de hoy, en Lima. */
export function hoyLima(): string {
  return fechaLima();
}

/** Día siguiente (calendario Lima) a la fecha dada. */
export function siguienteDiaLima(fechaYYYYMMDD: string): string {
  const { year, month, day } = parseFecha(fechaYYYYMMDD);
  const fecha = new Date(Date.UTC(year, month - 1, day + 1));
  return formatFecha(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth() + 1,
    fecha.getUTCDate(),
  );
}

/** Lunes de la semana calendario (Lima) que contiene la fecha dada. */
export function inicioSemanaLima(fechaYYYYMMDD: string): string {
  const { year, month, day } = parseFecha(fechaYYYYMMDD);
  const fecha = new Date(Date.UTC(year, month - 1, day));
  const diaSemana = fecha.getUTCDay(); // 0=domingo, 1=lunes, ...
  const diffAlLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  fecha.setUTCDate(fecha.getUTCDate() - diffAlLunes);
  return formatFecha(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth() + 1,
    fecha.getUTCDate(),
  );
}

/** Domingo de la semana calendario (Lima) que contiene la fecha dada. */
export function finSemanaLima(fechaYYYYMMDD: string): string {
  const inicio = inicioSemanaLima(fechaYYYYMMDD);
  const { year, month, day } = parseFecha(inicio);
  const fecha = new Date(Date.UTC(year, month - 1, day + 6));
  return formatFecha(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth() + 1,
    fecha.getUTCDate(),
  );
}

/** Primer día del mes calendario (Lima) que contiene la fecha dada. */
export function inicioMesLima(fechaYYYYMMDD: string): string {
  const { year, month } = parseFecha(fechaYYYYMMDD);
  return formatFecha(year, month, 1);
}

/** Último día del mes calendario (Lima) que contiene la fecha dada. */
export function finMesLima(fechaYYYYMMDD: string): string {
  const { year, month } = parseFecha(fechaYYYYMMDD);
  const ultimoDia = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return formatFecha(year, month, ultimoDia);
}
