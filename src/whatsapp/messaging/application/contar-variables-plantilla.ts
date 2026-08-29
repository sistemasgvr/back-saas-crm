/** Cuenta variables {{1}}, {{2}}… de un texto de plantilla — Meta exige que
 * sean secuenciales desde 1, así que el máximo número encontrado es la
 * cantidad real de variables (PLAN-GESTION-LEADS-WHATSAPP.md §6). */
export function contarVariablesPlantilla(texto: string | undefined): number {
  if (!texto) return 0;
  const numeros = [...texto.matchAll(/\{\{(\d+)\}\}/g)].map((m) =>
    Number(m[1]),
  );
  return numeros.length > 0 ? Math.max(...numeros) : 0;
}
