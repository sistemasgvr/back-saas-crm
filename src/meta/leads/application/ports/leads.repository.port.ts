export const LEADS_REPOSITORY = Symbol('LEADS_REPOSITORY');

export interface UpsertLeadInput {
  organizacionId: string;
  metaPaginaId?: string;
  campanaId?: string;
  conjuntoAnuncioId?: string;
  anuncioId?: string;
  formularioId?: string;
  idExterno: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  datosCrudos: unknown;
  fechaLead?: Date;
}

export interface LeadsRepository {
  /** Idempotente por (organizacionId, idExterno) — un mismo leadgen_id nunca duplica fila (PLAN.md §8.2). */
  upsertPorIdExterno(
    input: UpsertLeadInput,
  ): Promise<{ id: string; creado: boolean }>;
  /** Check barato para saltar la resolución de campaña/conjunto/anuncio en
   * Graph cuando el lead ya fue importado — evita repetir llamadas caras en
   * cada re-sincronización (PLAN-FASE-14 §4.3). */
  buscarIdPorIdExterno(
    organizacionId: string,
    idExterno: string,
  ): Promise<string | null>;
}
