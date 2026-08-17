// America/Lima es UTC-5 fijo, sin horario de verano (PLAN.md §3.12), por lo
// que basta un offset constante — no hace falta una librería de timezones.

/** Instante UTC de las 00:00:00.000 en Lima para un día calendario "YYYY-MM-DD". */
export function inicioDiaLimaUtc(fechaYYYYMMDD: string): Date {
  return new Date(`${fechaYYYYMMDD}T00:00:00.000-05:00`);
}

/** Instante UTC de las 23:59:59.999 en Lima para un día calendario "YYYY-MM-DD". */
export function finDiaLimaUtc(fechaYYYYMMDD: string): Date {
  return new Date(`${fechaYYYYMMDD}T23:59:59.999-05:00`);
}
