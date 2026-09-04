import {
  esEstadoTerminal,
  etiquetasPorTipo,
} from '../../shared/domain/pipeline-inmobiliaria';

/**
 * Ranking de probabilidad de adquisición de un inmueble (más → menos):
 * 1. Interés explícito (`inmuebleInteresId` = este inmueble) — score alto
 * 2. Visitas a este inmueble — REALIZADA > PROGRAMADA; NO_SHOW/CANCELADA sin boost
 * 3. `estadoGestion`: etapas avanzadas (SEPARACION, NEGOCIACION, VISITA_REALIZADA…)
 *    > tempranas (NUEVO, CONTACTADO); terminales perdidos/descartados/ganados al final
 * 4. Tip: COMPRA encaja con operación VENTA; VENTA tip no suma en catálogo de venta
 * 5. Recencia (`estadoGestionEn` / última visita)
 */

export type OrigenInteres = 'interes' | 'visita' | 'ambos';

export interface VisitaRankingInput {
  estado: string;
  programadaEn: Date;
  fechaModificacion: Date;
}

export interface LeadRankingInput {
  id: string;
  nombre: string | null;
  telefono: string | null;
  estadoGestion: string;
  tipoLead: string | null;
  estadoGestionEn: Date | null;
  interesExplicito: boolean;
  visitas: VisitaRankingInput[];
}

export interface InteresadoRankeado {
  id: string;
  nombre: string;
  telefono: string | null;
  estadoGestion: string;
  etiquetaEstado: string;
  tipoLead: string | null;
  score: number;
  motivoRanking: string[];
  origen: OrigenInteres;
}

/** Pesos de etapa — mayor = más cerca de cerrar. Terminales ≈ 0 (van al final). */
const PESO_ESTADO: Record<string, number> = {
  SEPARACION: 90,
  NEGOCIACION: 75,
  VISITA_REALIZADA: 60,
  EN_COMERCIALIZACION: 50,
  CAPTACION: 45,
  VISITA_AGENDADA: 40,
  CALIFICADO: 30,
  CONTACTADO: 15,
  NUEVO: 5,
  CERRADO_GANADO: 2,
  CERRADO_PERDIDO: 1,
  DESCARTADO: 0,
};

const SCORE_INTERES_EXPLICITO = 100;
const SCORE_VISITA_REALIZADA = 28;
const SCORE_VISITA_PROGRAMADA = 12;
const CAP_VISITAS = 3;
const SCORE_TIPO_COMPATIBLE = 18;
const SCORE_RECENCIA_MAX = 20;

function diasDesde(fecha: Date, ahora: Date): number {
  return Math.max(0, (ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function scoreRecencia(fecha: Date | null, ahora: Date): number {
  if (!fecha) return 0;
  const dias = diasDesde(fecha, ahora);
  if (dias <= 3) return SCORE_RECENCIA_MAX;
  if (dias <= 7) return 14;
  if (dias <= 14) return 8;
  if (dias <= 30) return 4;
  return 1;
}

function ultimaActividad(
  lead: LeadRankingInput,
): Date | null {
  let max: Date | null = lead.estadoGestionEn;
  for (const v of lead.visitas) {
    const cand =
      v.estado === 'REALIZADA' || v.estado === 'NO_SHOW' || v.estado === 'CANCELADA'
        ? v.fechaModificacion
        : v.programadaEn;
    if (!max || cand.getTime() > max.getTime()) max = cand;
  }
  return max;
}

function origenDe(lead: LeadRankingInput): OrigenInteres {
  const tieneVisita = lead.visitas.length > 0;
  if (lead.interesExplicito && tieneVisita) return 'ambos';
  if (lead.interesExplicito) return 'interes';
  return 'visita';
}

/** Heurística tip vs operación del inmueble. */
function scoreTipoLead(
  tipoLead: string | null,
  operacionInmueble: string,
  motivos: string[],
): number {
  if (!tipoLead) return 0;
  if (operacionInmueble === 'VENTA' && tipoLead === 'COMPRA') {
    motivos.push('Tip COMPRA alineado con venta del inmueble');
    return SCORE_TIPO_COMPATIBLE;
  }
  if (operacionInmueble === 'ALQUILER' && tipoLead === 'COMPRA') {
    motivos.push('Tip COMPRA (posible interés en alquiler)');
    return Math.floor(SCORE_TIPO_COMPATIBLE / 2);
  }
  if (tipoLead === 'VENTA') {
    // Propietario buscando comercializar — poco probable que adquiera este inmueble
    return 0;
  }
  return 0;
}

export function puntuarLeadInteresado(
  lead: LeadRankingInput,
  operacionInmueble: string,
  ahora: Date = new Date(),
): InteresadoRankeado {
  const motivos: string[] = [];
  let score = 0;

  if (lead.interesExplicito) {
    score += SCORE_INTERES_EXPLICITO;
    motivos.push('Interés explícito en este inmueble');
  }

  const realizadas = lead.visitas.filter((v) => v.estado === 'REALIZADA').length;
  const programadas = lead.visitas.filter((v) => v.estado === 'PROGRAMADA').length;
  const boostRealizadas =
    Math.min(realizadas, CAP_VISITAS) * SCORE_VISITA_REALIZADA;
  const boostProgramadas =
    Math.min(programadas, CAP_VISITAS) * SCORE_VISITA_PROGRAMADA;
  if (boostRealizadas > 0) {
    score += boostRealizadas;
    motivos.push(
      realizadas === 1
        ? '1 visita realizada'
        : `${realizadas} visitas realizadas`,
    );
  }
  if (boostProgramadas > 0) {
    score += boostProgramadas;
    motivos.push(
      programadas === 1
        ? '1 visita agendada'
        : `${programadas} visitas agendadas`,
    );
  }

  const pesoEstado = PESO_ESTADO[lead.estadoGestion] ?? 10;
  score += pesoEstado;
  if (pesoEstado >= 60) {
    motivos.push(`Etapa avanzada: ${lead.estadoGestion}`);
  } else if (esEstadoTerminal(lead.estadoGestion)) {
    motivos.push(`Estado terminal: ${lead.estadoGestion}`);
  }

  score += scoreTipoLead(lead.tipoLead, operacionInmueble, motivos);

  const recenciaFecha = ultimaActividad(lead);
  const boostRecencia = scoreRecencia(recenciaFecha, ahora);
  if (boostRecencia >= 14) {
    score += boostRecencia;
    motivos.push('Actividad reciente');
  } else {
    score += boostRecencia;
  }

  // Terminales perdidos/descartados: penalización fuerte para ir al final del ranking
  if (
    lead.estadoGestion === 'CERRADO_PERDIDO' ||
    lead.estadoGestion === 'DESCARTADO'
  ) {
    score = Math.min(score, 15);
  }

  const etiquetas = etiquetasPorTipo(lead.tipoLead);
  return {
    id: lead.id,
    nombre: lead.nombre?.trim() || 'Sin nombre',
    telefono: lead.telefono,
    estadoGestion: lead.estadoGestion,
    etiquetaEstado: etiquetas[lead.estadoGestion] ?? lead.estadoGestion,
    tipoLead: lead.tipoLead,
    score,
    motivoRanking: motivos,
    origen: origenDe(lead),
  };
}

export function rankearInteresados(
  leads: LeadRankingInput[],
  operacionInmueble: string,
  ahora: Date = new Date(),
): InteresadoRankeado[] {
  const rankeados = leads.map((l) =>
    puntuarLeadInteresado(l, operacionInmueble, ahora),
  );

  rankeados.sort((a, b) => {
    const aTerm =
      a.estadoGestion === 'CERRADO_PERDIDO' ||
      a.estadoGestion === 'DESCARTADO';
    const bTerm =
      b.estadoGestion === 'CERRADO_PERDIDO' ||
      b.estadoGestion === 'DESCARTADO';
    if (aTerm !== bTerm) return aTerm ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  return rankeados;
}
