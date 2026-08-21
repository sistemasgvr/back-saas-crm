export const LEADS_GESTION_REPOSITORY = Symbol('LEADS_GESTION_REPOSITORY');

export interface LeadParaGestion {
  id: string;
  asignadoUsuarioId: string | null;
}

export interface LeadsGestionRepository {
  /** Lectura mínima para checks de ownership/estado antes de mutar. */
  buscarParaGestion(
    organizacionId: string,
    id: string,
  ): Promise<LeadParaGestion | null>;
  /** Update condicional WHERE asignado_usuario_id IS NULL — race-safe:
   * devuelve false si otro ya lo tomó primero (PLAN §9 riesgos). */
  tomar(
    organizacionId: string,
    id: string,
    usuarioId: string,
  ): Promise<boolean>;
  asignar(
    organizacionId: string,
    id: string,
    usuarioId: string,
    asignadoPorUsuarioId: string,
  ): Promise<void>;
  liberar(organizacionId: string, id: string): Promise<void>;
  /** Evita asignar a alguien fuera de la organización. */
  esMiembroActivo(organizacionId: string, usuarioId: string): Promise<boolean>;
  actualizarTipo(
    organizacionId: string,
    id: string,
    tipoLead: string,
    usuarioEdicion: string,
  ): Promise<void>;
}
