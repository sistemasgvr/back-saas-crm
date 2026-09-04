import { TIPOS_LEAD_INMOBILIARIA } from './tipos-lead-inmobiliaria';
import type { TipoLeadInmobiliaria } from './tipos-lead-inmobiliaria';

/**
 * Pipeline profesional de leads — PLAN-PIPELINE-INMOBILIARIA.md.
 *
 * Matrices por defecto viven en código. Desde v1 una org puede guardar un
 * override JSON en `organizaciones.pipeline_config` (null = estas matrices).
 *
 * Se probó modelar esto con una librería de state machines (xstate), pero
 * cada matriz es literalmente un grafo dirigido de "desde estado X, hacia
 * estos estados" — un Record<string,string[]> más una función que revisa
 * membership es toda la máquina de estados que hace falta.
 */

/** Embudo de un tipoLead en el JSON de override por org. */
export interface EmbudoPipelineConfig {
  estados: string[];
  /** Clave = estado origen; valor = destinos permitidos. */
  transiciones: Record<string, string[]>;
  /** Etiquetas UI opcionales; si falta un código se usa el default de código. */
  etiquetas?: Record<string, string>;
}

/** Shape persistido en `organizaciones.pipeline_config`. */
export type PipelineConfigOverride = Record<
  TipoLeadInmobiliaria,
  EmbudoPipelineConfig
>;

const CODIGO_ESTADO_RE = /^[A-Z][A-Z0-9_]*$/;

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

function claveEmbudo(
  tipoLead: string | null | undefined,
): TipoLeadInmobiliaria {
  return normalizarTipo(tipoLead) ?? 'OTRO';
}

function embudoOverride(
  tipoLead: string | null | undefined,
  override?: PipelineConfigOverride | null,
): EmbudoPipelineConfig | null {
  if (!override) return null;
  return override[claveEmbudo(tipoLead)] ?? null;
}

function matrizCodigo(
  tipoLead: string | null | undefined,
): Record<string, readonly string[]> {
  const tipo = normalizarTipo(tipoLead);
  if (tipo === 'COMPRA') return TRANSICIONES_COMPRA;
  if (tipo === 'VENTA') return TRANSICIONES_VENTA;
  return TRANSICIONES_OTRO;
}

function etiquetasCodigo(
  tipoLead: string | null | undefined,
): Record<string, string> {
  const tipo = normalizarTipo(tipoLead);
  if (tipo === 'COMPRA') return ETIQUETAS_COMPRA;
  if (tipo === 'VENTA') return ETIQUETAS_VENTA;
  return ETIQUETAS_OTRO;
}

function estadosCodigo(
  tipoLead: string | null | undefined,
): readonly string[] {
  const tipo = normalizarTipo(tipoLead);
  if (tipo === 'COMPRA') return ESTADOS_COMPRA;
  if (tipo === 'VENTA') return ESTADOS_VENTA;
  return ESTADOS_OTRO;
}

/** Snapshot del pipeline por defecto (código) — para UI "restaurar" y GET. */
export function pipelineConfigPorDefecto(): PipelineConfigOverride {
  const build = (
    estados: readonly string[],
    transiciones: Record<string, readonly string[]>,
    etiquetas: Record<string, string>,
  ): EmbudoPipelineConfig => ({
    estados: [...estados],
    transiciones: Object.fromEntries(
      Object.entries(transiciones).map(([desde, hacia]) => [desde, [...hacia]]),
    ),
    etiquetas: { ...etiquetas },
  });

  return {
    COMPRA: build(ESTADOS_COMPRA, TRANSICIONES_COMPRA, ETIQUETAS_COMPRA),
    VENTA: build(ESTADOS_VENTA, TRANSICIONES_VENTA, ETIQUETAS_VENTA),
    OTRO: build(ESTADOS_OTRO, TRANSICIONES_OTRO, ETIQUETAS_OTRO),
  };
}

function esRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validarEmbudo(
  tipo: TipoLeadInmobiliaria,
  raw: unknown,
): EmbudoPipelineConfig {
  if (!esRecord(raw)) {
    throw new Error(`pipeline_config.${tipo} debe ser un objeto`);
  }

  if (!Array.isArray(raw.estados) || raw.estados.length === 0) {
    throw new Error(
      `pipeline_config.${tipo}.estados debe ser un arreglo no vacío`,
    );
  }

  const estados: string[] = [];
  const vistos = new Set<string>();
  for (const item of raw.estados) {
    if (typeof item !== 'string' || !CODIGO_ESTADO_RE.test(item)) {
      throw new Error(
        `pipeline_config.${tipo}.estados: código inválido (${String(item)})`,
      );
    }
    if (vistos.has(item)) {
      throw new Error(
        `pipeline_config.${tipo}.estados: código duplicado (${item})`,
      );
    }
    vistos.add(item);
    estados.push(item);
  }

  if (!vistos.has('NUEVO')) {
    throw new Error(`pipeline_config.${tipo}.estados debe incluir NUEVO`);
  }
  for (const terminal of ESTADOS_TERMINALES) {
    if (!vistos.has(terminal)) {
      throw new Error(
        `pipeline_config.${tipo}.estados debe incluir ${terminal}`,
      );
    }
  }

  if (!esRecord(raw.transiciones)) {
    throw new Error(`pipeline_config.${tipo}.transiciones debe ser un objeto`);
  }

  const transiciones: Record<string, string[]> = {};
  for (const estado of estados) {
    const destinosRaw = raw.transiciones[estado];
    if (destinosRaw === undefined) {
      throw new Error(
        `pipeline_config.${tipo}.transiciones falta la clave ${estado}`,
      );
    }
    if (!Array.isArray(destinosRaw)) {
      throw new Error(
        `pipeline_config.${tipo}.transiciones.${estado} debe ser un arreglo`,
      );
    }
    const destinos: string[] = [];
    for (const d of destinosRaw) {
      if (typeof d !== 'string' || !vistos.has(d)) {
        throw new Error(
          `pipeline_config.${tipo}.transiciones.${estado}: destino inválido (${String(d)})`,
        );
      }
      if (!destinos.includes(d)) destinos.push(d);
    }
    if (
      (ESTADOS_TERMINALES as readonly string[]).includes(estado) &&
      destinos.length > 0
    ) {
      throw new Error(
        `pipeline_config.${tipo}.transiciones.${estado}: un estado terminal no puede tener salidas`,
      );
    }
    transiciones[estado] = destinos;
  }

  for (const clave of Object.keys(raw.transiciones)) {
    if (!vistos.has(clave)) {
      throw new Error(
        `pipeline_config.${tipo}.transiciones tiene clave desconocida (${clave})`,
      );
    }
  }

  let etiquetas: Record<string, string> | undefined;
  if (raw.etiquetas !== undefined) {
    if (!esRecord(raw.etiquetas)) {
      throw new Error(`pipeline_config.${tipo}.etiquetas debe ser un objeto`);
    }
    etiquetas = {};
    for (const [codigo, etiqueta] of Object.entries(raw.etiquetas)) {
      if (!vistos.has(codigo)) {
        throw new Error(
          `pipeline_config.${tipo}.etiquetas tiene código desconocido (${codigo})`,
        );
      }
      if (typeof etiqueta !== 'string' || !etiqueta.trim()) {
        throw new Error(
          `pipeline_config.${tipo}.etiquetas.${codigo} debe ser texto no vacío`,
        );
      }
      etiquetas[codigo] = etiqueta.trim();
    }
  }

  return etiquetas
    ? { estados, transiciones, etiquetas }
    : { estados, transiciones };
}

/**
 * Valida y normaliza el JSON de override. Lanza Error con mensaje en español
 * si la forma es inválida.
 */
export function validarPipelineConfig(raw: unknown): PipelineConfigOverride {
  if (!esRecord(raw)) {
    throw new Error('pipeline_config debe ser un objeto');
  }

  const resultado = {} as PipelineConfigOverride;
  for (const tipo of TIPOS_LEAD_INMOBILIARIA) {
    if (!(tipo in raw)) {
      throw new Error(`pipeline_config debe incluir ${tipo}`);
    }
    resultado[tipo] = validarEmbudo(tipo, raw[tipo]);
  }

  const extras = Object.keys(raw).filter(
    (k) => !(TIPOS_LEAD_INMOBILIARIA as readonly string[]).includes(k),
  );
  if (extras.length > 0) {
    throw new Error(
      `pipeline_config tiene claves desconocidas: ${extras.join(', ')}`,
    );
  }

  return resultado;
}

/** Lectura segura: null si está vacío o corrupto (fallback a código). */
export function parsePipelineConfig(
  raw: unknown,
): PipelineConfigOverride | null {
  if (raw === null || raw === undefined) return null;
  try {
    return validarPipelineConfig(raw);
  } catch {
    return null;
  }
}

/** null/undefined y 'OTRO' comparten el embudo corto — un lead sin tipoLead
 * aún clasificado solo puede moverse por NUEVO/CONTACTADO/DESCARTADO, ver
 * requiereTipoLeadDefinido(). */
export function matrizPorTipo(
  tipoLead: string | null | undefined,
  override?: PipelineConfigOverride | null,
): Record<string, readonly string[]> {
  const embudo = embudoOverride(tipoLead, override);
  if (embudo) return embudo.transiciones;
  return matrizCodigo(tipoLead);
}

export function etiquetasPorTipo(
  tipoLead: string | null | undefined,
  override?: PipelineConfigOverride | null,
): Record<string, string> {
  const base = etiquetasCodigo(tipoLead);
  const embudo = embudoOverride(tipoLead, override);
  if (!embudo) return base;
  const map: Record<string, string> = {};
  for (const codigo of embudo.estados) {
    map[codigo] =
      embudo.etiquetas?.[codigo] ?? base[codigo] ?? codigo;
  }
  return map;
}

/** Columnas del kanban cuando se listan todos los tipos a la vez. */
export const ESTADOS_TABLERO_UNIFICADO = [
  'NUEVO',
  'CONTACTADO',
  'CALIFICADO',
  'VISITA_AGENDADA',
  'VISITA_REALIZADA',
  'CAPTACION',
  'EN_COMERCIALIZACION',
  'NEGOCIACION',
  'SEPARACION',
  'CERRADO_GANADO',
  'CERRADO_PERDIDO',
  'DESCARTADO',
] as const;

function etiquetasTableroUnificado(
  override?: PipelineConfigOverride | null,
): Record<string, string> {
  if (!override) {
    const map: Record<string, string> = {};
    for (const codigo of ESTADOS_TABLERO_UNIFICADO) {
      map[codigo] =
        ETIQUETAS_COMPRA[codigo] ??
        ETIQUETAS_VENTA[codigo] ??
        ETIQUETAS_OTRO[codigo] ??
        codigo;
    }
    return map;
  }

  const map: Record<string, string> = {};
  for (const tipo of TIPOS_LEAD_INMOBILIARIA) {
    const etiquetas = etiquetasPorTipo(tipo, override);
    for (const [codigo, etiqueta] of Object.entries(etiquetas)) {
      if (!(codigo in map)) map[codigo] = etiqueta;
    }
  }
  return map;
}

function estadosTableroUnificado(
  override?: PipelineConfigOverride | null,
): readonly string[] {
  if (!override) return ESTADOS_TABLERO_UNIFICADO;
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const tipo of TIPOS_LEAD_INMOBILIARIA) {
    for (const codigo of override[tipo].estados) {
      if (vistos.has(codigo)) continue;
      vistos.add(codigo);
      resultado.push(codigo);
    }
  }
  return resultado;
}

/** `tipoLead` undefined = tablero unificado (todos los tipos). */
export function estadosColumnasTablero(
  tipoLead: string | undefined,
  override?: PipelineConfigOverride | null,
): readonly string[] {
  if (tipoLead === undefined) return estadosTableroUnificado(override);
  return estadosPorTipo(tipoLead, override);
}

export function etiquetasColumnasTablero(
  tipoLead: string | undefined,
  override?: PipelineConfigOverride | null,
): Record<string, string> {
  if (tipoLead === undefined) return etiquetasTableroUnificado(override);
  return etiquetasPorTipo(tipoLead, override);
}

export function estadosPorTipo(
  tipoLead: string | null | undefined,
  override?: PipelineConfigOverride | null,
): readonly string[] {
  const embudo = embudoOverride(tipoLead, override);
  if (embudo) return embudo.estados;
  return estadosCodigo(tipoLead);
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
  override?: PipelineConfigOverride | null,
): readonly string[] {
  return matrizPorTipo(tipoLead, override)[estadoActual] ?? [];
}

export function esTransicionValida(
  tipoLead: string | null | undefined,
  desde: string,
  hacia: string,
  override?: PipelineConfigOverride | null,
): boolean {
  return transicionesPermitidas(tipoLead, desde, override).includes(hacia);
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

/** Solo en etapas tempranas se puede reclasificar Compra/Venta/Otro — una vez
 * calificado o más adelante el embudo ya tiene datos (visitas, captación…)
 * atados al tipo. */
export const ESTADOS_PERMITEN_CAMBIO_TIPO = ['NUEVO', 'CONTACTADO'] as const;

export function puedeCambiarTipoLead(estadoGestion: string): boolean {
  return (ESTADOS_PERMITEN_CAMBIO_TIPO as readonly string[]).includes(
    estadoGestion,
  );
}

export function tipoLeadClasificado(
  tipoLead: string | null | undefined,
): tipoLead is TipoLeadInmobiliaria {
  return TIPOS_LEAD_INMOBILIARIA.includes(tipoLead as TipoLeadInmobiliaria);
}

/** Un lead en NUEVO debe tener tipo Lead definido antes de salir de esa etapa. */
export function debeClasificarTipoDesdeNuevo(
  estadoActual: string,
  estadoDestino: string,
  tipoLead: string | null | undefined,
): boolean {
  return (
    estadoActual === 'NUEVO' &&
    estadoDestino !== 'NUEVO' &&
    !tipoLeadClasificado(tipoLead)
  );
}

/** Si el lead ya avanzó más allá de Contactado, cambiar Compra/Venta/Otro
 * reinicia el embudo a CONTACTADO y cancela visitas programadas. */
export function cambioTipoReiniciaEmbudo(estadoGestion: string): boolean {
  return !puedeCambiarTipoLead(estadoGestion);
}

export const ESTADO_TRAS_REINICIO_POR_CAMBIO_TIPO = 'CONTACTADO' as const;

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
