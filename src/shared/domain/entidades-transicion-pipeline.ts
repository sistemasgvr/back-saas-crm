import { randomUUID } from 'crypto';

/** Mapea metadata validada a entidades estructuradas (Fase 22). */

export interface CrearVisitaTransicionInput {
  id: string;
  programadaEn: Date;
  referenciaInmueble: string;
  modalidad: string;
  nota?: string | null;
  asignadoUsuarioId: string | null;
  creadoPorUsuarioId: string;
}

export interface CerrarVisitaTransicionInput {
  resultado: string;
  feedback?: string | null;
}

export interface CrearCalificacionTransicionInput {
  id: string;
  tipoLead: string | null;
  presupuesto?: string | null;
  zona?: string | null;
  tipoInmueble?: string | null;
  tipoPropiedad?: string | null;
  precioReferencia?: string | null;
  nota: string;
  usuarioId: string;
}

const CAMPOS_VISITA = new Set([
  'visitaProgramadaEn',
  'referenciaInmueble',
  'modalidadVisita',
]);

const CAMPOS_CALIFICACION = new Set([
  'presupuesto',
  'zona',
  'tipoInmueble',
  'tipoPropiedad',
  'precioReferencia',
]);

const CAMPOS_VISITA_CIERRE = new Set(['resultadoVisita']);

/** Metadata que queda en historial (sin duplicar visita/calificación). */
export function metadataHistorialLigera(
  estadoDestino: string,
  metadata: Record<string, string> | null,
): Record<string, string> | null {
  if (!metadata) return null;

  const excluir = new Set<string>();
  if (estadoDestino === 'VISITA_AGENDADA') {
    CAMPOS_VISITA.forEach((c) => excluir.add(c));
  }
  if (estadoDestino === 'VISITA_REALIZADA') {
    CAMPOS_VISITA_CIERRE.forEach((c) => excluir.add(c));
  }
  if (estadoDestino === 'CALIFICADO') {
    CAMPOS_CALIFICACION.forEach((c) => excluir.add(c));
  }

  const resultado: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(metadata)) {
    if (!excluir.has(clave) && valor) resultado[clave] = valor;
  }
  return Object.keys(resultado).length > 0 ? resultado : null;
}

export function construirVisitaDesdeMetadata(
  metadata: Record<string, string> | null | undefined,
  ctx: {
    asignadoUsuarioId: string | null;
    creadoPorUsuarioId: string;
    notaTransicion?: string | null;
  },
): CrearVisitaTransicionInput | null {
  if (!metadata?.visitaProgramadaEn || !metadata.referenciaInmueble) return null;
  const programadaEn = new Date(metadata.visitaProgramadaEn);
  if (Number.isNaN(programadaEn.getTime())) return null;

  return {
    id: randomUUID(),
    programadaEn,
    referenciaInmueble: metadata.referenciaInmueble,
    modalidad: metadata.modalidadVisita ?? 'PRESENCIAL',
    nota: ctx.notaTransicion ?? null,
    asignadoUsuarioId: ctx.asignadoUsuarioId,
    creadoPorUsuarioId: ctx.creadoPorUsuarioId,
  };
}

export function construirCierreVisitaDesdeMetadata(
  metadata: Record<string, string> | null | undefined,
  notaTransicion?: string | null,
): CerrarVisitaTransicionInput | null {
  if (!metadata?.resultadoVisita) return null;
  return {
    resultado: metadata.resultadoVisita,
    feedback: notaTransicion ?? null,
  };
}

export function construirCalificacionDesdeMetadata(
  tipoLead: string | null,
  metadata: Record<string, string> | null | undefined,
  notaTransicion: string | null | undefined,
  usuarioId: string,
): CrearCalificacionTransicionInput | null {
  const nota = notaTransicion?.trim();
  if (!nota) return null;

  return {
    id: randomUUID(),
    tipoLead,
    presupuesto: metadata?.presupuesto ?? null,
    zona: metadata?.zona ?? null,
    tipoInmueble: metadata?.tipoInmueble ?? null,
    tipoPropiedad: metadata?.tipoPropiedad ?? null,
    precioReferencia: metadata?.precioReferencia ?? null,
    nota,
    usuarioId,
  };
}

export function estadoVisitaDesdeResultado(resultado: string): string {
  if (resultado === 'ASISTIO') return 'REALIZADA';
  if (resultado === 'NO_SHOW') return 'NO_SHOW';
  return 'CANCELADA';
}
