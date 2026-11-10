/**
 * Serialización CSV mínima (RFC 4180) pensada para abrirse en Excel:
 * BOM UTF-8, comillas cuando hace falta y neutralización de fórmulas
 * (=, +, -, @) para evitar inyección al abrir el archivo.
 */
export const CSV_BOM = '﻿';

const INICIO_FORMULA = /^[=@\t\r]/;
/** +51 999 888 777 / -12.5 son datos, no fórmulas: no se tocan. */
const NUMERO_O_TELEFONO = /^[+-][\d\s().-]*$/;

function pareceFormula(texto: string): boolean {
  if (INICIO_FORMULA.test(texto)) return true;
  return /^[+-]/.test(texto) && !NUMERO_O_TELEFONO.test(texto);
}

export function valorCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  let texto: string;
  if (valor instanceof Date) {
    texto = valor.toISOString();
  } else if (typeof valor === 'bigint') {
    texto = valor.toString();
  } else if (typeof valor === 'object') {
    // Prisma.Decimal expone toString(); el resto (Json) se serializa.
    const conToString = valor as { toFixed?: unknown; toString(): string };
    texto =
      typeof conToString.toFixed === 'function'
        ? conToString.toString()
        : JSON.stringify(valor);
  } else if (typeof valor === 'string') {
    texto = valor;
  } else if (typeof valor === 'number' || typeof valor === 'boolean') {
    texto = String(valor);
  } else {
    texto = '';
  }
  if (typeof valor === 'string' && pareceFormula(texto)) {
    texto = `'${texto}`;
  }
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

/**
 * "2026-10-23 14:05:00" en la zona horaria de la empresa: Excel y Power BI lo
 * reconocen como fecha/hora (el ISO con "T…Z" queda como texto en Excel).
 * `soloDia` es para columnas @db.Date, que no tienen hora ni zona.
 */
export function formatearFecha(
  fecha: Date,
  zonaHoraria: string,
  soloDia = false,
): string {
  if (soloDia) return fecha.toISOString().slice(0, 10);
  let f = formateadores.get(zonaHoraria);
  if (!f) {
    // sv-SE da "AAAA-MM-DD HH:mm:ss".
    f = new Intl.DateTimeFormat('sv-SE', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formateadores.set(zonaHoraria, f);
  }
  return f.format(fecha);
}

export function filaCsv(valores: readonly unknown[]): string {
  return `${valores.map(valorCsv).join(',')}\r\n`;
}
