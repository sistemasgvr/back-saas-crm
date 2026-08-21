export const META_FORMULARIOS_REPOSITORY = Symbol(
  'META_FORMULARIOS_REPOSITORY',
);

export interface MetaFormularioRow {
  id: string;
  organizacionId: string;
  metaPaginaId: string;
  formId: string;
  nombre: string;
  estadoMeta: string | null;
  locale: string | null;
  ultimoSyncEn: Date | null;
  fechaCreacion: Date;
  totalLeads: number;
}

export interface FormularioFiltro {
  id: string;
  nombre: string;
}

export interface FormularioParaBackfill {
  metaPaginaId: string;
  formId: string;
  nombre: string;
  fechaCreacion: Date;
}

export interface UpsertFormularioInput {
  organizacionId: string;
  metaPaginaId: string;
  formId: string;
  nombre: string;
  estadoMeta?: string;
  locale?: string;
  usuarioEdicion: string;
}

export interface MetaFormulariosRepository {
  /** Lista BD de forms de una página (perfil de página) — solo si la página sigue activa. */
  listarPorPagina(
    organizacionId: string,
    metaPaginaId: string,
  ): Promise<MetaFormularioRow[]>;
  /** Lectura mínima sin paginar para el filtro de /leads (?metaPaginaId= opcional). */
  listarActivosFiltro(
    organizacionId: string,
    metaPaginaId?: string,
  ): Promise<FormularioFiltro[]>;
  /** Forms activos de páginas activas — para sync masivo desde /leads. */
  listarActivosParaBackfill(
    organizacionId: string,
  ): Promise<FormularioParaBackfill[]>;
  /** Crea o reactiva (si existía soft-deleted) — evita filas duplicadas al re-sincronizar. */
  upsertVinculado(input: UpsertFormularioInput): Promise<MetaFormularioRow>;
}
