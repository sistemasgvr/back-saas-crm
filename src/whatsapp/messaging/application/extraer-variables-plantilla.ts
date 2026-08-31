/**
 * Variables de plantillas de WhatsApp — Meta soporta dos formatos
 * (WhatsApp Business Platform, "Aspectos básicos de las plantillas", vigente
 * en Graph API v23+ y v26):
 *
 *  - Posicional (legacy): {{1}}, {{2}}… numerado y secuencial. Nadie sabe qué
 *    va en cada uno sin mirar el texto completo.
 *  - Con nombre (el que usamos acá): {{nombre_cliente}}, {{numero_pedido}}…
 *    el propio nombre dice qué valor va ahí. Debe ser minúsculas, números y
 *    guiones bajos, empezando con una letra.
 *
 * Este módulo solo extrae/valida variables CON NOMBRE — es lo único que
 * ofrece el formulario de creación de plantillas de este CRM. El soporte de
 * plantillas posicionales legacy (creadas fuera del CRM, ej. directo en
 * Meta Business Manager) vive en el envío, no en la creación: ver
 * `formatoParametros` en MetaPlantillaWhatsAppGraph.
 */
const PATRON_TOKEN = /\{\{([^{}]+)\}\}/g;
const PATRON_NOMBRE_VALIDO = /^[a-z][a-z0-9_]*$/;

export interface VariablesPlantilla {
  /** Nombres únicos y válidos, en el orden en que aparecen por primera vez. */
  validas: string[];
  /** Tokens dentro de {{ }} que NO cumplen el formato que exige Meta —
   * incluye tanto errores de tipeo (espacios, mayúsculas) como el viejo
   * formato posicional {{1}}, {{2}} (ya no lo usamos al crear). */
  invalidas: string[];
}

export function extraerVariablesPlantilla(
  texto: string | undefined,
): VariablesPlantilla {
  const validas: string[] = [];
  const invalidas: string[] = [];
  if (!texto) return { validas, invalidas };

  for (const match of texto.matchAll(PATRON_TOKEN)) {
    const nombre = match[1].trim();
    if (PATRON_NOMBRE_VALIDO.test(nombre)) {
      if (!validas.includes(nombre)) validas.push(nombre);
    } else if (!invalidas.includes(nombre)) {
      invalidas.push(nombre);
    }
  }
  return { validas, invalidas };
}
