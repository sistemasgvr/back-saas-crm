/** Rubros de organización — único valor operativo por ahora es INMOBILIARIA.
 * El campo en BD es VARCHAR libre (no enum Postgres) para no requerir
 * migración cuando se sume un rubro nuevo; esta lista es lo único que la UI
 * ofrece hoy. PLAN-GESTION-LEADS-WHATSAPP.md §3. */
export const RUBRO_INMOBILIARIA = 'INMOBILIARIA' as const;

export const RUBROS_SOPORTADOS = [RUBRO_INMOBILIARIA] as const;

export type RubroOrganizacion = (typeof RUBROS_SOPORTADOS)[number];
