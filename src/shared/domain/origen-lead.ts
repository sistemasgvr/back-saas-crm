/** Canal de captación del lead — columna `leads.origen`. */
export const ORIGENES_LEAD = ['META', 'WHATSAPP', 'MANUAL'] as const;
export type OrigenLead = (typeof ORIGENES_LEAD)[number];

export const ETIQUETA_ORIGEN_LEAD: Record<OrigenLead, string> = {
  META: 'Meta',
  WHATSAPP: 'WhatsApp',
  MANUAL: 'Manual',
};
