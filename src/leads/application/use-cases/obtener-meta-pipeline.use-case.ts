import { Injectable } from '@nestjs/common';
import {
  estadosPorTipo,
  etiquetaMotivo,
  etiquetasPorTipo,
  MOTIVOS_DESCARTE,
  MOTIVOS_PERDIDO,
  motivosGanado,
  transicionesPermitidas,
} from '../../../shared/domain/pipeline-inmobiliaria';

export interface EstadoPipelineMeta {
  codigo: string;
  etiqueta: string;
  /** Próximos estados válidos desde este — el front pinta solo estos, no
   * todo el catálogo (PLAN §8.2: "no una lista completa confusa"). */
  siguientes: readonly string[];
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
    };
  }
}
