export const ESTADOS_LLAMADA = {
  RINGING: 'RINGING',
  PRE_ACCEPTED: 'PRE_ACCEPTED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  REJECTED: 'REJECTED',
  MISSED: 'MISSED',
  FAILED: 'FAILED',
} as const;

export type EstadoLlamada =
  (typeof ESTADOS_LLAMADA)[keyof typeof ESTADOS_LLAMADA];

export const RESULTADOS_LLAMADA = {
  CONTESTADA: 'CONTESTADA',
  NO_CONTESTADA: 'NO_CONTESTADA',
  RECHAZADA: 'RECHAZADA',
  OCUPADO: 'OCUPADO',
  FALLIDA: 'FALLIDA',
} as const;

export type ResultadoLlamada =
  (typeof RESULTADOS_LLAMADA)[keyof typeof RESULTADOS_LLAMADA];

export const DIRECCIONES_LLAMADA = {
  ENTRANTE: 'ENTRANTE',
  SALIENTE: 'SALIENTE',
} as const;

export type DireccionLlamada =
  (typeof DIRECCIONES_LLAMADA)[keyof typeof DIRECCIONES_LLAMADA];

/** Estados en los que un agente puede reclamar la llamada (claim lock). */
export const ESTADOS_RECLAMABLES: EstadoLlamada[] = [
  ESTADOS_LLAMADA.RINGING,
  ESTADOS_LLAMADA.PRE_ACCEPTED,
];
