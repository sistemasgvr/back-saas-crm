/** Últimos N dígitos de un teléfono, sin signos/espacios — suficiente para
 * emparejar un wa_id de Meta (E.164 sin '+') contra Lead.telefono guardado en
 * formatos distintos ("+51987654321", "987654321", "51 987 654 321").
 * Heurística MVP: no resuelve todos los casos (números cortos, extensiones),
 * documentado en PLAN-GESTION-LEADS-WHATSAPP.md §9 como riesgo conocido. */
const DIGITOS_SIGNIFICATIVOS = 9;

export function ultimosDigitos(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '');
  return soloDigitos.slice(-DIGITOS_SIGNIFICATIVOS);
}
