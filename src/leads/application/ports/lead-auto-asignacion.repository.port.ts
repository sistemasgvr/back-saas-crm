export interface LeadAutoAsignacionConfig {
  habilitado: boolean;
  usuarioIds: string[];
  siguienteIndice: number;
}

export interface LeadAutoAsignacionRepository {
  obtenerConfig(
    organizacionId: string,
  ): Promise<LeadAutoAsignacionConfig | null>;

  actualizarConfig(input: {
    organizacionId: string;
    habilitado: boolean;
    usuarioIds: string[];
  }): Promise<void>;

  /**
   * Encola un lead para procesarlo en orden (por `fecha_lead`).
   * Dedup por (organizacionId, leadId).
   */
  encolarLead(input: {
    organizacionId: string;
    leadId: string;
    fechaLead: Date;
  }): Promise<void>;

  /**
   * Lectura mínima para decidir si encolamos el lead (y cuál es su `fechaLead`
   * efectiva para ordenar). Devuelve `null` si el lead no existe.
   */
  obtenerLeadParaAutoAsignacion(input: {
    organizacionId: string;
    leadId: string;
  }): Promise<{ asignadoUsuarioId: string | null; fechaLeadEfectiva: Date } | null>;

  /**
   * Asigna de inmediato un lead concreto (si sigue libre y el pool está ON).
   * Avanza el cursor round-robin y lo saca de la cola.
   * @returns usuario destino o null si no se asignó.
   */
  asignarLeadPendiente(
    organizacionId: string,
    leadId: string,
  ): Promise<string | null>;

  /**
   * Drena la cola del tenant en orden por fechaLead. Asigna leads libres al
   * usuario que toca por cursor. Items inválidos se descartan sin abortar.
   */
  procesarCola(organizacionId: string): Promise<void>;
}

export const LEAD_AUTO_ASIGNACION_REPOSITORY = Symbol(
  'LEAD_AUTO_ASIGNACION_REPOSITORY',
);
