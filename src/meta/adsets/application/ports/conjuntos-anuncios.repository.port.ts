export const CONJUNTOS_ANUNCIOS_REPOSITORY = Symbol('CONJUNTOS_ANUNCIOS_REPOSITORY');

export interface ConjuntoAnuncioFiltro {
  id: string;
  campanaId: string;
  nombre: string;
  estadoMeta: string | null;
}

export interface UpsertConjuntoAnuncioInput {
  organizacionId: string;
  campanaId: string;
  metaConjuntoId: string;
  nombre: string;
  estadoMeta?: string;
  datosCrudos?: unknown;
}

export interface ConjuntosAnunciosRepository {
  listarPorOrganizacion(organizacionId: string, campanaId?: string): Promise<ConjuntoAnuncioFiltro[]>;
  /** Idempotente por (organizacionId, metaConjuntoId) — usado por la ingestión del webhook (Fase 9). */
  upsertPorMetaId(input: UpsertConjuntoAnuncioInput): Promise<{ id: string }>;
}
