/** Intención del lead — solo aplica al rubro INMOBILIARIA por ahora.
 * PLAN-GESTION-LEADS-WHATSAPP.md §3/§4.2. */
export const TIPOS_LEAD_INMOBILIARIA = ['COMPRA', 'VENTA', 'OTRO'] as const;

export type TipoLeadInmobiliaria = (typeof TIPOS_LEAD_INMOBILIARIA)[number];
