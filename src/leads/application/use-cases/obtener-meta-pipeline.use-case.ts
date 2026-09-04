import { Injectable, Inject } from '@nestjs/common';
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
  parsePipelineConfig,
  transicionesPermitidas,
  type PipelineConfigOverride,
} from '../../../shared/domain/pipeline-inmobiliaria';
import { ORGANIZACIONES_REPOSITORY } from '../../../organizations/application/ports/organizaciones.repository.port';
import type { OrganizacionesRepository } from '../../../organizations/application/ports/organizaciones.repository.port';

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
  /** true si la org tiene override JSON activo. */
  usandoOverride: boolean;
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
 * un tipoLead dado. Usa `pipeline_config` de la org si existe; si no, las
 * matrices de código. */
@Injectable()
export class ObtenerMetaPipelineUseCase {
  constructor(
    @Inject(ORGANIZACIONES_REPOSITORY)
    private readonly organizaciones: OrganizacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    tipoLead: string | null | undefined,
  ): Promise<MetaPipeline> {
    const raw = await this.organizaciones.obtenerPipelineConfig(organizacionId);
    const override: PipelineConfigOverride | null = parsePipelineConfig(raw);

    const etiquetas = etiquetasPorTipo(tipoLead, override);
    const estados = estadosPorTipo(tipoLead, override).map((codigo) => ({
      codigo,
      etiqueta: etiquetas[codigo] ?? codigo,
      siguientes: transicionesPermitidas(tipoLead, codigo, override),
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
      usandoOverride: override !== null,
    };
  }
}
