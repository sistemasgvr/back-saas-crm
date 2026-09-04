import type { TipoLeadInmobiliaria } from './tipos-lead-inmobiliaria';

/** Campo típico de Meta Lead Ads (`field_data`) o pregunta de formulario. */
export interface CampoTextoMeta {
  name?: string | null;
  values?: readonly (string | null | undefined)[] | null;
  /** Texto de la pregunta (formularios Graph / questions). */
  label?: string | null;
  question?: string | null;
}

const KEYWORDS_COMPRA = [
  'compra',
  'comprar',
  'quiero comprar',
  'busco comprar',
  'interesado en comprar',
  'comprar casa',
  'comprar departamento',
  'comprar inmueble',
  'adquirir',
  'buyer',
  'looking to buy',
  'want to buy',
] as const;

const KEYWORDS_VENTA = [
  'venta',
  'vender',
  'quiero vender',
  'busco vender',
  'interesado en vender',
  'vender casa',
  'vender departamento',
  'vender inmueble',
  'poner en venta',
  'captacion',
  'captación',
  'seller',
  'looking to sell',
  'want to sell',
] as const;

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function corpusDesdeCampos(campos: readonly CampoTextoMeta[]): string {
  const partes: string[] = [];
  for (const c of campos) {
    if (c.name) partes.push(c.name);
    if (c.label) partes.push(c.label);
    if (c.question) partes.push(c.question);
    for (const v of c.values ?? []) {
      if (v) partes.push(v);
    }
  }
  return normalizar(partes.join(' '));
}

function cuentaKeywords(texto: string, keywords: readonly string[]): number {
  let n = 0;
  for (const kw of keywords) {
    const k = normalizar(kw);
    if (!k) continue;
    // Palabra/frase completa: evita que "compra" dispare dentro de "recompra" rara.
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`,
      'u',
    );
    if (re.test(texto)) n += 1;
  }
  return n;
}

/**
 * Heurística no bloqueante: infiere COMPRA o VENTA desde textos de Meta
 * (`field_data` / questions). Devuelve null si no hay señal clara o hay empate.
 * Nunca sugiere OTRO — eso queda para clasificación manual.
 */
export function inferirTipoLeadDesdeFieldData(
  campos: readonly CampoTextoMeta[] | null | undefined,
): Extract<TipoLeadInmobiliaria, 'COMPRA' | 'VENTA'> | null {
  if (!campos?.length) return null;

  const texto = corpusDesdeCampos(campos);
  if (!texto) return null;

  const scoreCompra = cuentaKeywords(texto, KEYWORDS_COMPRA);
  const scoreVenta = cuentaKeywords(texto, KEYWORDS_VENTA);

  if (scoreCompra === 0 && scoreVenta === 0) return null;
  if (scoreCompra === scoreVenta) return null;
  return scoreCompra > scoreVenta ? 'COMPRA' : 'VENTA';
}
