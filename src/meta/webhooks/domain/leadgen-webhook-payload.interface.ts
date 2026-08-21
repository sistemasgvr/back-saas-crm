export interface LeadgenWebhookPayload {
  object?: string;
  entry?: {
    id?: string;
    time?: number;
    changes?: {
      field?: string;
      value?: { leadgen_id?: string; page_id?: string };
    }[];
  }[];
}

export interface EventoLeadgen {
  pageId: string;
  leadgenId: string;
}

export function extraerEventosLeadgen(
  payload: LeadgenWebhookPayload,
): EventoLeadgen[] {
  const eventos: EventoLeadgen[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;
      const pageId = change.value?.page_id ?? entry.id;
      const leadgenId = change.value?.leadgen_id;
      if (pageId && leadgenId) {
        eventos.push({ pageId, leadgenId });
      }
    }
  }

  return eventos;
}
