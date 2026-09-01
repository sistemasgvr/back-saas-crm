import { Injectable } from '@nestjs/common';
import {
  camposAlEntrarEstado,
  camposReapertura,
  type CampoTransicionDef,
} from '../../../shared/domain/campos-transicion-pipeline';
import {
  estadosPorTipo,
  etiquetaMotivo,
  etiquetasPorTipo,
  MOTIVOS_DESCARTE,
  MOTIVOS_PERDIDO,
  motivosGanado,
  transicionesPermitidas,
} from '../../../shared/domain/pipeline-inmobiliaria';

export interface CampoTransicionMeta {
  codigo: string;
  etiqueta: string;
  tipo: CampoTransicionDef['tipo'];
  requerido: boolean;
  placeholder?: string;
  opciones?: { codigo: string; etiqueta: string }[];
}

export interface EstadoPipelineMeta {
  codigo: string;
  etiqueta: string;
  /** Próximos estados válidos desde este — el front pinta solo estos, no
   * todo el catálogo (PLAN §8.2: "no una lista completa confusa"). */
  siguientes: readonly string[];
  /** Campos a completar al entrar a este estado (desde cualquier origen válido). */
  camposAlEntrar: CampoTransicionMeta[];
}

export interface MotivoMeta {
  codigo: string;
  etiqueta: string;
}

export interface MetaPipeline {
  estados: EstadoPipelineMeta[];
  motivosDescarte: MotivoMeta[];
  motivosPerdido: MotivoMeta[];
  motivosGanado: MotivoMeta[];
  camposReapertura: CampoTransicionMeta[];
}

function mapearCampos(campos: CampoTransicionDef[]): CampoTransicionMeta[] {
  return campos.map((campo) => ({
    codigo: campo.codigo,
    etiqueta: campo.etiqueta,
    tipo: campo.tipo,
    requerido: campo.requerido,
    placeholder: campo.placeholder,
    opciones: campo.opciones?.map((o) => ({
      codigo: o.codigo,
      etiqueta: o.etiqueta,
    })),
  }));
}

/** GET /leads/pipeline/meta — catálogo de estados/transiciones/motivos para
 * un tipoLead dado, así el front no hardcodea el copy compra/venta
 * (PLAN-PIPELINE-INMOBILIARIA.md §8.3). Sin acceso a datos: es 100% dominio. */
@Injectable()
export class ObtenerMetaPipelineUseCase {
  execute(tipoLead: string | null | undefined): MetaPipeline {
    const etiquetas = etiquetasPorTipo(tipoLead);
    const estados = estadosPorTipo(tipoLead).map((codigo) => ({
      codigo,
      etiqueta: etiquetas[codigo] ?? codigo,
      siguientes: transicionesPermitidas(tipoLead, codigo),
      camposAlEntrar: mapearCampos(camposAlEntrarEstado(tipoLead, codigo)),
    }));

    const motivo = (codigo: string): MotivoMeta => ({
      codigo,
      etiqueta: etiquetaMotivo(codigo),
    });

    return {
      estados,
      motivosDescarte: MOTIVOS_DESCARTE.map(motivo),
      motivosPerdido: MOTIVOS_PERDIDO.map(motivo),
      motivosGanado: motivosGanado(tipoLead).map(motivo),
      camposReapertura: mapearCampos(camposReapertura()),
    };
  }
}
