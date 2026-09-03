/** Tipos de actividad de agenda (independientes del pipeline). */

export const TIPOS_ACTIVIDAD_AGENDA = [
  'VISITA',
  'LLAMADA',
  'REUNION',
  'SEGUIMIENTO',
  'OTRO',
] as const;

export type TipoActividadAgenda = (typeof TIPOS_ACTIVIDAD_AGENDA)[number];

export const ESTADOS_ACTIVIDAD_AGENDA = [
  'PROGRAMADA',
  'COMPLETADA',
  'CANCELADA',
] as const;

export type EstadoActividadAgenda = (typeof ESTADOS_ACTIVIDAD_AGENDA)[number];

export const ETIQUETAS_TIPO_ACTIVIDAD: Record<TipoActividadAgenda, string> = {
  VISITA: 'Visita',
  LLAMADA: 'Llamada',
  REUNION: 'Reunión',
  SEGUIMIENTO: 'Seguimiento',
  OTRO: 'Otra',
};

export function esTipoActividadAgenda(v: string): v is TipoActividadAgenda {
  return (TIPOS_ACTIVIDAD_AGENDA as readonly string[]).includes(v);
}

export function esEstadoActividadAgenda(v: string): v is EstadoActividadAgenda {
  return (ESTADOS_ACTIVIDAD_AGENDA as readonly string[]).includes(v);
}

export function tituloDefaultActividad(
  tipo: TipoActividadAgenda,
  referenciaInmueble?: string | null,
): string {
  if (tipo === 'VISITA' && referenciaInmueble?.trim()) {
    return `Visita — ${referenciaInmueble.trim()}`;
  }
  return ETIQUETAS_TIPO_ACTIVIDAD[tipo];
}
