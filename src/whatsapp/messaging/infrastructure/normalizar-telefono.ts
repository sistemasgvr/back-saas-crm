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

/** Convierte Lead.telefono a wa_id candidato (E.164 sin '+'): si ya trae código
 * de país (>= 11 dígitos) se usa tal cual; si son 9 dígitos (celular Perú) se
 * antepone "51". */
export function telefonoAWaId(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length >= 11) return digitos;
  if (digitos.length === 9) return `51${digitos}`;
  return null;
}
