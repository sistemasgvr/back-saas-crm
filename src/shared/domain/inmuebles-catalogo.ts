/** Catálogo de inmuebles (Fase 25). */

export const TIPOS_INMUEBLE = [
  'DEPARTAMENTO',
  'CASA',
  'TERRENO',
  'LOCAL',
  'OFICINA',
  'OTRO',
] as const;

export const OPERACIONES_INMUEBLE = ['VENTA', 'ALQUILER'] as const;

export const ESTADOS_INMUEBLE = [
  'DISPONIBLE',
  'RESERVADO',
  'VENDIDO',
  'INACTIVO',
] as const;

export type TipoInmuebleCodigo = (typeof TIPOS_INMUEBLE)[number];
export type OperacionInmuebleCodigo = (typeof OPERACIONES_INMUEBLE)[number];
export type EstadoInmuebleCodigo = (typeof ESTADOS_INMUEBLE)[number];
