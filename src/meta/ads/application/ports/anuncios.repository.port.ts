export const ANUNCIOS_REPOSITORY = Symbol('ANUNCIOS_REPOSITORY');

export interface AnuncioFiltro {
  id: string;
  conjuntoAnuncioId: string;
  nombre: string;
  estadoMeta: string | null;
}

export interface UpsertAnuncioInput {
  organizacionId: string;
  conjuntoAnuncioId: string;
  metaAnuncioId: string;
  nombre: string;
  estadoMeta?: string;
  datosCrudos?: unknown;
}

export interface AnunciosRepository {
  listarPorOrganizacion(organizacionId: string, conjuntoAnuncioId?: string): Promise<AnuncioFiltro[]>;
  /** Idempotente por (organizacionId, metaAnuncioId) — usado por la ingestión del webhook (Fase 9). */
  upsertPorMetaId(input: UpsertAnuncioInput): Promise<{ id: string }>;
}
