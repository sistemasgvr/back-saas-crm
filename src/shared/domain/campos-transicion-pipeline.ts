import type { TipoLeadInmobiliaria } from './tipos-lead-inmobiliaria';
import { TIPOS_LEAD_INMOBILIARIA } from './tipos-lead-inmobiliaria';
import { esEstadoTerminal } from './pipeline-inmobiliaria';

/** Tipos de campo que el front puede renderizar al avanzar el pipeline. */
export type TipoCampoTransicion = 'text' | 'textarea' | 'datetime' | 'select';

export interface OpcionCampoTransicion {
  codigo: string;
  etiqueta: string;
}

export interface CampoTransicionDef {
  codigo: string;
  etiqueta: string;
  tipo: TipoCampoTransicion;
  requerido: boolean;
  placeholder?: string;
  opciones?: readonly OpcionCampoTransicion[];
}

export interface ValidacionTransicionInput {
  notaTransicion?: string | null;
  notaCierre?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ValidacionTransicionResult {
  valido: boolean;
  errores: string[];
}

const OPCIONES_CANAL_CONTACTO: readonly OpcionCampoTransicion[] = [
  { codigo: 'WHATSAPP', etiqueta: 'WhatsApp' },
  { codigo: 'LLAMADA', etiqueta: 'Llamada' },
  { codigo: 'EMAIL', etiqueta: 'Correo' },
  { codigo: 'PRESENCIAL', etiqueta: 'Presencial' },
  { codigo: 'OTRO', etiqueta: 'Otro' },
];

const OPCIONES_MODALIDAD_VISITA: readonly OpcionCampoTransicion[] = [
  { codigo: 'PRESENCIAL', etiqueta: 'Presencial' },
  { codigo: 'VIRTUAL', etiqueta: 'Virtual / videollamada' },
];

const OPCIONES_RESULTADO_VISITA: readonly OpcionCampoTransicion[] = [
  { codigo: 'ASISTIO', etiqueta: 'Asistió' },
  { codigo: 'NO_SHOW', etiqueta: 'No se presentó' },
  { codigo: 'CANCELADA', etiqueta: 'Cancelada' },
];

const NOTA: CampoTransicionDef = {
  codigo: 'notaTransicion',
  etiqueta: 'Nota de seguimiento',
  tipo: 'textarea',
  requerido: true,
  placeholder: 'Qué pasó, acuerdos, próximos pasos…',
};

const NOTA_OPCIONAL: CampoTransicionDef = {
  ...NOTA,
  requerido: false,
};

function normalizarTipo(
  tipoLead: string | null | undefined,
): TipoLeadInmobiliaria | null {
  return TIPOS_LEAD_INMOBILIARIA.includes(tipoLead as TipoLeadInmobiliaria)
    ? (tipoLead as TipoLeadInmobiliaria)
    : null;
}

function camposCompra(estadoDestino: string): CampoTransicionDef[] {
  switch (estadoDestino) {
    case 'CONTACTADO':
      return [
        {
          codigo: 'canalContacto',
          etiqueta: 'Canal de contacto',
          tipo: 'select',
          requerido: false,
          opciones: OPCIONES_CANAL_CONTACTO,
        },
        NOTA_OPCIONAL,
      ];
    case 'CALIFICADO':
      return [
        NOTA,
        {
          codigo: 'presupuesto',
          etiqueta: 'Presupuesto aproximado',
          tipo: 'text',
          requerido: false,
          placeholder: 'Ej. S/ 350,000 – 450,000',
        },
        {
          codigo: 'zona',
          etiqueta: 'Zona de interés',
          tipo: 'text',
          requerido: false,
          placeholder: 'Distrito o sector',
        },
        {
          codigo: 'tipoInmueble',
          etiqueta: 'Tipo de inmueble',
          tipo: 'text',
          requerido: false,
          placeholder: 'Ej. departamento 3 dorm.',
        },
      ];
    case 'VISITA_AGENDADA':
      return [
        {
          codigo: 'visitaProgramadaEn',
          etiqueta: 'Fecha y hora de la visita',
          tipo: 'datetime',
          requerido: true,
        },
        {
          codigo: 'duracionMinutos',
          etiqueta: 'Duración',
          tipo: 'select',
          requerido: false,
          opciones: [
            { codigo: '30', etiqueta: '30 minutos' },
            { codigo: '60', etiqueta: '60 minutos' },
            { codigo: '90', etiqueta: '90 minutos' },
            { codigo: '120', etiqueta: '2 horas' },
            { codigo: '180', etiqueta: '3 horas' },
          ],
        },
        {
          codigo: 'referenciaInmueble',
          etiqueta: 'Inmueble o proyecto',
          tipo: 'text',
          requerido: true,
          placeholder: 'Nombre del proyecto, dirección o referencia',
        },
        {
          codigo: 'modalidadVisita',
          etiqueta: 'Modalidad',
          tipo: 'select',
          requerido: false,
          opciones: OPCIONES_MODALIDAD_VISITA,
        },
        NOTA_OPCIONAL,
      ];
    case 'VISITA_REALIZADA':
      return [
        {
          codigo: 'resultadoVisita',
          etiqueta: 'Resultado de la visita',
          tipo: 'select',
          requerido: true,
          opciones: OPCIONES_RESULTADO_VISITA,
        },
        NOTA,
      ];
    case 'NEGOCIACION':
    case 'SEPARACION':
      return [
        NOTA,
        {
          codigo: 'montoReferencia',
          etiqueta: 'Monto de referencia',
          tipo: 'text',
          requerido: false,
          placeholder: 'Oferta, seña o rango negociado',
        },
      ];
    default:
      return [];
  }
}

function camposVenta(estadoDestino: string): CampoTransicionDef[] {
  switch (estadoDestino) {
    case 'CONTACTADO':
      return [
        {
          codigo: 'canalContacto',
          etiqueta: 'Canal de contacto',
          tipo: 'select',
          requerido: false,
          opciones: OPCIONES_CANAL_CONTACTO,
        },
        NOTA_OPCIONAL,
      ];
    case 'CALIFICADO':
      return [
        NOTA,
        {
          codigo: 'tipoPropiedad',
          etiqueta: 'Tipo de propiedad',
          tipo: 'text',
          requerido: false,
          placeholder: 'Ej. casa, terreno, local',
        },
        {
          codigo: 'zona',
          etiqueta: 'Zona / ubicación',
          tipo: 'text',
          requerido: false,
        },
        {
          codigo: 'precioReferencia',
          etiqueta: 'Precio esperado',
          tipo: 'text',
          requerido: false,
          placeholder: 'Expectativa del propietario',
        },
      ];
    case 'CAPTACION':
      return [
        NOTA,
        {
          codigo: 'direccion',
          etiqueta: 'Dirección del inmueble',
          tipo: 'text',
          requerido: false,
          placeholder: 'Calle, distrito',
        },
        {
          codigo: 'precioPedido',
          etiqueta: 'Precio de publicación',
          tipo: 'text',
          requerido: false,
        },
      ];
    case 'EN_COMERCIALIZACION':
      return [NOTA];
    case 'NEGOCIACION':
    case 'SEPARACION':
      return [
        NOTA,
        {
          codigo: 'montoReferencia',
          etiqueta: 'Monto de referencia',
          tipo: 'text',
          requerido: false,
        },
      ];
    default:
      return [];
  }
}

function camposOtro(estadoDestino: string): CampoTransicionDef[] {
  switch (estadoDestino) {
    case 'CONTACTADO':
      return [
        {
          codigo: 'canalContacto',
          etiqueta: 'Canal de contacto',
          tipo: 'select',
          requerido: false,
          opciones: OPCIONES_CANAL_CONTACTO,
        },
        NOTA_OPCIONAL,
      ];
    case 'CALIFICADO':
      return [NOTA];
    default:
      return [];
  }
}

/** Catálogo de campos al entrar a `estadoDestino` para el tipoLead dado. */
export function camposAlEntrarEstado(
  tipoLead: string | null | undefined,
  estadoDestino: string,
): CampoTransicionDef[] {
  if (esEstadoTerminal(estadoDestino)) return [];

  const tipo = normalizarTipo(tipoLead);
  if (tipo === 'COMPRA') return camposCompra(estadoDestino);
  if (tipo === 'VENTA') return camposVenta(estadoDestino);
  return camposOtro(estadoDestino);
}

/** Reapertura: nota opcional para dejar contexto. */
export function camposReapertura(): CampoTransicionDef[] {
  return [NOTA_OPCIONAL];
}

export function requiereFormularioTransicion(
  tipoLead: string | null | undefined,
  estadoDestino: string,
  esReapertura = false,
): boolean {
  if (esEstadoTerminal(estadoDestino)) return true;
  const campos = esReapertura
    ? camposReapertura()
    : camposAlEntrarEstado(tipoLead, estadoDestino);
  return campos.some((c) => c.requerido);
}

function valorCampo(
  campo: CampoTransicionDef,
  input: ValidacionTransicionInput,
): string | undefined {
  if (campo.codigo === 'notaTransicion') {
    const nota = input.notaTransicion?.trim();
    return nota || undefined;
  }
  const raw = input.metadata?.[campo.codigo];
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  return String(raw);
}

function esDatetimeValido(valor: string): boolean {
  const ms = Date.parse(valor);
  return !Number.isNaN(ms);
}

function opcionValida(
  campo: CampoTransicionDef,
  valor: string,
): boolean {
  if (!campo.opciones?.length) return true;
  return campo.opciones.some((o) => o.codigo === valor);
}

/** Valida nota + metadata contra el catálogo del estado destino. */
export function validarTransicionPipeline(
  tipoLead: string | null | undefined,
  estadoDestino: string,
  input: ValidacionTransicionInput,
  opciones?: { esReapertura?: boolean },
): ValidacionTransicionResult {
  const campos = opciones?.esReapertura
    ? camposReapertura()
    : camposAlEntrarEstado(tipoLead, estadoDestino);

  if (campos.length === 0) {
    return { valido: true, errores: [] };
  }

  const errores: string[] = [];

  for (const campo of campos) {
    const valor = valorCampo(campo, input);

    if (campo.requerido && !valor) {
      errores.push(`El campo "${campo.etiqueta}" es obligatorio`);
      continue;
    }

    if (!valor) continue;

    if (campo.tipo === 'datetime' && !esDatetimeValido(valor)) {
      errores.push(`"${campo.etiqueta}" debe ser una fecha y hora válidas`);
    }

    if (campo.tipo === 'select' && !opcionValida(campo, valor)) {
      errores.push(`"${campo.etiqueta}" tiene un valor no permitido`);
    }

    if (campo.codigo === 'notaTransicion' && valor.length > 500) {
      errores.push('La nota no puede superar 500 caracteres');
    }

    if (
      campo.tipo === 'text' &&
      campo.codigo !== 'notaTransicion' &&
      valor.length > 200
    ) {
      errores.push(`"${campo.etiqueta}" no puede superar 200 caracteres`);
    }
  }

  // Rechazar claves desconocidas en metadata (solo las del catálogo)
  if (input.metadata) {
    const permitidos = new Set(
      campos.filter((c) => c.codigo !== 'notaTransicion').map((c) => c.codigo),
    );
    for (const clave of Object.keys(input.metadata)) {
      if (!permitidos.has(clave)) {
        errores.push(`Campo no permitido en esta transición: ${clave}`);
      }
    }
  }

  return { valido: errores.length === 0, errores };
}

/** Devuelve solo las claves permitidas con valores string no vacíos. */
export function extraerMetadataTransicion(
  tipoLead: string | null | undefined,
  estadoDestino: string,
  metadata: Record<string, unknown> | null | undefined,
  opciones?: { esReapertura?: boolean },
): Record<string, string> | null {
  const campos = opciones?.esReapertura
    ? camposReapertura()
    : camposAlEntrarEstado(tipoLead, estadoDestino);

  if (!metadata || campos.length === 0) return null;

  const resultado: Record<string, string> = {};
  for (const campo of campos) {
    if (campo.codigo === 'notaTransicion') continue;
    const valor = valorCampo(campo, { metadata });
    if (valor) resultado[campo.codigo] = valor;
  }

  return Object.keys(resultado).length > 0 ? resultado : null;
}

/** Etiquetas legibles para mostrar metadata en timeline / UI. */
export const ETIQUETAS_METADATA: Record<string, string> = {
  canalContacto: 'Canal',
  presupuesto: 'Presupuesto',
  zona: 'Zona',
  tipoInmueble: 'Tipo de inmueble',
  visitaProgramadaEn: 'Visita programada',
  duracionMinutos: 'Duración',
  referenciaInmueble: 'Inmueble',
  modalidadVisita: 'Modalidad',
  resultadoVisita: 'Resultado',
  tipoPropiedad: 'Tipo de propiedad',
  precioReferencia: 'Precio esperado',
  direccion: 'Dirección',
  precioPedido: 'Precio pedido',
  montoReferencia: 'Monto',
};

export function etiquetaValorMetadata(
  codigo: string,
  valor: unknown,
): string {
  if (valor === null || valor === undefined) return '';
  const str = String(valor);

  const opciones: Record<string, readonly OpcionCampoTransicion[]> = {
    canalContacto: OPCIONES_CANAL_CONTACTO,
    modalidadVisita: OPCIONES_MODALIDAD_VISITA,
    resultadoVisita: OPCIONES_RESULTADO_VISITA,
  };
  const cat = opciones[codigo];
  if (cat) {
    return cat.find((o) => o.codigo === str)?.etiqueta ?? str;
  }

  if (codigo === 'visitaProgramadaEn') {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    }
  }

  if (codigo === 'duracionMinutos') {
    const n = Number.parseInt(str, 10);
    if (n === 120) return '2 horas';
    if (n === 180) return '3 horas';
    if (!Number.isNaN(n)) return `${n} minutos`;
  }

  return str;
}
