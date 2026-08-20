export const CAMPANAS_REPOSITORY = Symbol('CAMPANAS_REPOSITORY');

export interface CampanaFiltro {
  id: string;
  nombre: string;
  estadoMeta: string | null;
  metaCuentaPublicitariaId: string | null;
}

export interface UpsertCampanaInput {
  organizacionId: string;
  metaCampanaId: string;
  nombre: string;
  estadoMeta?: string;
  datosCrudos?: unknown;
  /** NULL hasta que el sync manual de la cuenta (Fase 13.3) la resuelva. */
  metaCuentaPublicitariaId?: string;
}

export interface CampanasRepository {
  listarPorOrganizacion(organizacionId: string): Promise<CampanaFiltro[]>;
  /** Idempotente por (organizacionId, metaCampanaId) — usado por la ingestión del webhook (Fase 9). */
  upsertPorMetaId(input: UpsertCampanaInput): Promise<{ id: string }>;
}
