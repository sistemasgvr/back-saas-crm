import { TIPOS_LEAD_INMOBILIARIA } from './tipos-lead-inmobiliaria';
import type { TipoLeadInmobiliaria } from './tipos-lead-inmobiliaria';

/**
 * Pipeline profesional de leads — PLAN-PIPELINE-INMOBILIARIA.md.
 *
 * Las matrices de transición viven acá, en código (no en BD) — así lo pide
 * el plan (§4, "vive en código, no en BD en v1"): un catálogo por org
 * configurable es fase futura, hoy alcanza con la vertical INMOBILIARIA.
 *
 * Se probó modelar esto con una librería de state machines (xstate), pero
 * cada matriz es literalmente un grafo dirigido de "desde estado X, hacia
 * estos estados" — un Record<string,string[]> más una función que revisa
 * membership es toda la máquina de estados que hace falta. Traer una
 * dependencia para eso sería peor: más código, más superficie para bugs,
 * sin ganar nada (no hay actores, efectos paralelos, ni jerarquías que
 * xstate resuelva mejor que un objeto plano + `includes()`).
 */

export const ESTADOS_TERMINALES = [
  'CERRADO_GANADO',
  'CERRADO_PERDIDO',
  'DESCARTADO',
] as const;
export type EstadoTerminal = (typeof ESTADOS_TERMINALES)[number];

/** Códigos que existen igual en los tres embudos — si cambia el tipoLead
 * con el pipeline ya avanzado, un estado en esta lista se conserva; si no,
 * el lead vuelve a CONTACTADO (regla §4.1.5). */
const ESTADOS_COMUNES = [
  'NUEVO',
  'CONTACTADO',
  'CALIFICADO',
  'NEGOCIACION',
  'SEPARACION',
  ...ESTADOS_TERMINALES,
] as const;

// ---------------------------------------------------------------------------
// Embudo COMPRA (§3.2 / §4.2)
// ---------------------------------------------------------------------------
export const ESTADOS_COMPRA = [
  'NUEVO',
  'CONTACTADO',
  'CALIFICADO',
  'VISITA_AGENDADA',
  'VISITA_REALIZADA',
  'NEGOCIACION',
  'SEPARACION',
  'CERRADO_GANADO',
  'CERRADO_PERDIDO',
  'DESCARTADO',
] as const;

const TRANSICIONES_COMPRA: Record<string, readonly string[]> = {
  NUEVO: ['CONTACTADO', 'DESCARTADO'],
  CONTACTADO: ['CALIFICADO', 'DESCARTADO'],
  CALIFICADO: [
    'VISITA_AGENDADA',
    'NEGOCIACION',
    'DESCARTADO',
    'CERRADO_PERDIDO',
  ],
  VISITA_AGENDADA: [
    'VISITA_REALIZADA',
    'CALIFICADO',
    'DESCARTADO',
    'CERRADO_PERDIDO',
  ],
  VISITA_REALIZADA: [
    'NEGOCIACION',
    'VISITA_AGENDADA',
    'DESCARTADO',
    'CERRADO_PERDIDO',
  ],
  NEGOCIACION: [
    'SEPARACION',
    'CERRADO_GANADO',
    'CERRADO_PERDIDO',
    'DESCARTADO',
  ],
  SEPARACION: [
    'CERRADO_GANADO',
    'CERRADO_PERDIDO',
    'NEGOCIACION',
    'DESCARTADO',
  ],
  CERRADO_GANADO: [],
  CERRADO_PERDIDO: [],
  DESCARTADO: [],
};

const ETIQUETAS_COMPRA: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CALIFICADO: 'Calificado',
  VISITA_AGENDADA: 'Visita agendada',
  VISITA_REALIZADA: 'Visita realizada',
  NEGOCIACION: 'Negociación',
  SEPARACION: 'Separación / reserva',
  CERRADO_GANADO: 'Cerrado ganado',
  CERRADO_PERDIDO: 'Cerrado perdido',
  DESCARTADO: 'Descartado',
};

// ---------------------------------------------------------------------------
// Embudo VENTA (§3.3 / §4.3)
// ---------------------------------------------------------------------------
export const ESTADOS_VENTA = [
  'NUEVO',
  'CONTACTADO',
  'CALIFICADO',
  'CAPTACION',
  'EN_COMERCIALIZACION',
  'NEGOCIACION',
  'SEPARACION',
  'CERRADO_GANADO',
  'CERRADO_PERDIDO',
  'DESCARTADO',
] as const;

const TRANSICIONES_VENTA: Record<string, readonly string[]> = {
  NUEVO: ['CONTACTADO', 'DESCARTADO'],
  CONTACTADO: ['CALIFICADO', 'DESCARTADO'],
  CALIFICADO: ['CAPTACION', 'DESCARTADO', 'CERRADO_PERDIDO'],
  CAPTACION: ['EN_COMERCIALIZACION', 'DESCARTADO', 'CERRADO_PERDIDO'],
  EN_COMERCIALIZACION: ['NEGOCIACION', 'DESCARTADO', 'CERRADO_PERDIDO'],
  NEGOCIACION: [
    'SEPARACION',
    'CERRADO_GANADO',
    'CERRADO_PERDIDO',
    'DESCARTADO',
  ],
  SEPARACION: [
    'CERRADO_GANADO',
    'CERRADO_PERDIDO',
    'NEGOCIACION',
    'DESCARTADO',
  ],
  CERRADO_GANADO: [],
  CERRADO_PERDIDO: [],
  DESCARTADO: [],
};

const ETIQUETAS_VENTA: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CALIFICADO: 'Calificado',
  CAPTACION: 'Captación',
  EN_COMERCIALIZACION: 'En comercialización',
  NEGOCIACION: 'Negociación',
  SEPARACION: 'Separación / reserva',
  CERRADO_GANADO: 'Cerrado ganado',
  CERRADO_PERDIDO: 'Cerrado perdido',
  DESCARTADO: 'Descartado',
};

// ---------------------------------------------------------------------------
// Embudo OTRO — corto (§3.4). También es el que se usa mientras tipoLead
// todavía no está definido (null), acotado por requiereTipoLeadDefinido().
// ---------------------------------------------------------------------------
export const ESTADOS_OTRO = [
  'NUEVO',
  'CONTACTADO',
  'CALIFICADO',
  'CERRADO_GANADO',
  'CERRADO_PERDIDO',
  'DESCARTADO',
] as const;

const TRANSICIONES_OTRO: Record<string, readonly string[]> = {
  NUEVO: ['CONTACTADO', 'DESCARTADO'],
  CONTACTADO: ['CALIFICADO', 'DESCARTADO'],
  CALIFICADO: ['CERRADO_GANADO', 'CERRADO_PERDIDO', 'DESCARTADO'],
  CERRADO_GANADO: [],
  CERRADO_PERDIDO: [],
  DESCARTADO: [],
};

const ETIQUETAS_OTRO: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CALIFICADO: 'Calificado',
  CERRADO_GANADO: 'Cerrado ganado',
  CERRADO_PERDIDO: 'Cerrado perdido',
  DESCARTADO: 'Descartado',
};

// ---------------------------------------------------------------------------
// Motivos de cierre — catálogo en código v1 (§5.3)
// ---------------------------------------------------------------------------
export const MOTIVOS_DESCARTE = [
  'DUPLICADO',
  'DATOS_INVALIDOS',
  'SPAM',
  'NO_INTERESA',
  'FUERA_ZONA',
  'OTRO',
] as const;

export const MOTIVOS_PERDIDO = [
  'PRECIO',
  'COMPETENCIA',
  'SIN_RESPUESTA',
  'FINANCIAMIENTO',
  'RETIRO_CLIENTE',
  'OTRO',
] as const;

const MOTIVOS_GANADO_POR_TIPO: Record<TipoLeadInmobiliaria, readonly string[]> =
  {
    COMPRA: ['COMPRA_CERRADA', 'OTRO'],
    VENTA: ['VENTA_CERRADA', 'OTRO'],
    OTRO: ['OTRO'],
  };

const ETIQUETAS_MOTIVO: Record<string, string> = {
  DUPLICADO: 'Duplicado',
  DATOS_INVALIDOS: 'Datos inválidos',
  SPAM: 'Spam',
  NO_INTERESA: 'No le interesa',
  FUERA_ZONA: 'Fuera de zona',
  PRECIO: 'Precio',
  COMPETENCIA: 'Se fue con la competencia',
  SIN_RESPUESTA: 'Sin respuesta',
  FINANCIAMIENTO: 'No consiguió financiamiento',
  RETIRO_CLIENTE: 'El cliente se retiró',
  COMPRA_CERRADA: 'Compra cerrada',
  VENTA_CERRADA: 'Venta cerrada',
  OTRO: 'Otro',
};

// ---------------------------------------------------------------------------
// API pública del módulo
// ---------------------------------------------------------------------------

function normalizarTipo(
  tipoLead: string | null | undefined,
): TipoLeadInmobiliaria | null {
  return TIPOS_LEAD_INMOBILIARIA.includes(tipoLead as TipoLeadInmobiliaria)
    ? (tipoLead as TipoLeadInmobiliaria)
    : null;
}

/** null/undefined y 'OTRO' comparten el embudo corto — un lead sin tipoLead
 * aún clasificado solo puede moverse por NUEVO/CONTACTADO/DESCARTADO, ver
 * requiereTipoLeadDefinido(). */
export function matrizPorTipo(
  tipoLead: string | null | undefined,
): Record<string, readonly string[]> {
  const tipo = normalizarTipo(tipoLead);
  if (tipo === 'COMPRA') return TRANSICIONES_COMPRA;
  if (tipo === 'VENTA') return TRANSICIONES_VENTA;
  return TRANSICIONES_OTRO;
}

export function etiquetasPorTipo(
  tipoLead: string | null | undefined,
): Record<string, string> {
  const tipo = normalizarTipo(tipoLead);
  if (tipo === 'COMPRA') return ETIQUETAS_COMPRA;
  if (tipo === 'VENTA') return ETIQUETAS_VENTA;
  return ETIQUETAS_OTRO;
}

export function estadosPorTipo(
  tipoLead: string | null | undefined,
): readonly string[] {
  const tipo = normalizarTipo(tipoLead);
  if (tipo === 'COMPRA') return ESTADOS_COMPRA;
  if (tipo === 'VENTA') return ESTADOS_VENTA;
  return ESTADOS_OTRO;
}

export function motivosGanado(
  tipoLead: string | null | undefined,
): readonly string[] {
  return MOTIVOS_GANADO_POR_TIPO[normalizarTipo(tipoLead) ?? 'OTRO'];
}

export function etiquetaMotivo(motivo: string): string {
  return ETIQUETAS_MOTIVO[motivo] ?? motivo;
}

export function esEstadoTerminal(estado: string): estado is EstadoTerminal {
  return (ESTADOS_TERMINALES as readonly string[]).includes(estado);
}

/** Próximos estados válidos desde `estadoActual`, para este tipoLead. Vacío
 * si el estado es terminal (reabrir es una acción aparte, ver puedeReabrir). */
export function transicionesPermitidas(
  tipoLead: string | null | undefined,
  estadoActual: string,
): readonly string[] {
  return matrizPorTipo(tipoLead)[estadoActual] ?? [];
}

export function esTransicionValida(
  tipoLead: string | null | undefined,
  desde: string,
  hacia: string,
): boolean {
  return transicionesPermitidas(tipoLead, desde).includes(hacia);
}

/** CALIFICADO en adelante exige tipoLead definido (COMPRA/VENTA/OTRO) — regla
 * de producto §3.1: "para salir de NUEVO/CONTACTADO... tipo_lead debe estar
 * definido". NUEVO/CONTACTADO/DESCARTADO no lo requieren. */
export function requiereTipoLeadDefinido(estadoDestino: string): boolean {
  return !['NUEVO', 'CONTACTADO', 'DESCARTADO'].includes(estadoDestino);
}

/** Reapertura (§4.1.4): terminal → CONTACTADO | CALIFICADO, solo PROPIETARIO/
 * ADMINISTRADOR (el chequeo de rol vive en el use-case, esto solo valida el destino). */
export const ESTADOS_REAPERTURA = ['CONTACTADO', 'CALIFICADO'] as const;

export function esReaperturaValida(
  estadoActual: string,
  estadoDestino: string,
): boolean {
  return (
    esEstadoTerminal(estadoActual) &&
    (ESTADOS_REAPERTURA as readonly string[]).includes(estadoDestino)
  );
}

/** Al cambiar tipoLead con el pipeline ya avanzado (§4.1.5): un estado común
 * a los tres embudos se conserva tal cual; si no, se resetea a CONTACTADO. */
export function estadoAlCambiarTipo(estadoActual: string): string {
  return (ESTADOS_COMUNES as readonly string[]).includes(estadoActual)
    ? estadoActual
    : 'CONTACTADO';
}

/** Unión de los tres embudos — para validar a nivel de DTO que el código
 * exista EN ALGÚN embudo; la validación fina de "existe para ESTE tipoLead"
 * pasa por matrizPorTipo() en el use-case. */
export const TODOS_LOS_ESTADOS_GESTION = [
  ...new Set([...ESTADOS_COMPRA, ...ESTADOS_VENTA, ...ESTADOS_OTRO]),
] as const;

export const TODOS_LOS_MOTIVOS = [
  ...new Set([
    ...MOTIVOS_DESCARTE,
    ...MOTIVOS_PERDIDO,
    'COMPRA_CERRADA',
    'VENTA_CERRADA',
  ]),
] as const;
