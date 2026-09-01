import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { TIPOS_LEAD_INMOBILIARIA } from '../../../shared/domain/tipos-lead-inmobiliaria';
import {
  TODOS_LOS_ESTADOS_GESTION,
  TODOS_LOS_MOTIVOS,
} from '../../../shared/domain/pipeline-inmobiliaria';

export class ActualizarGestionLeadDto {
  @ApiPropertyOptional({
    enum: TIPOS_LEAD_INMOBILIARIA,
    description:
      'Intención comercial del lead — define qué embudo/catálogo de estados aplica.',
  })
  @IsOptional()
  @IsIn(TIPOS_LEAD_INMOBILIARIA)
  tipoLead?: string;

  @ApiPropertyOptional({
    enum: TODOS_LOS_ESTADOS_GESTION,
    description:
      'Próximo estado del pipeline — debe ser una transición válida desde el estado actual para el ' +
      'tipoLead vigente (ver GET /leads/pipeline/meta). El backend valida la matriz completa.',
  })
  @IsOptional()
  @IsIn(TODOS_LOS_ESTADOS_GESTION)
  estadoGestion?: string;

  @ApiPropertyOptional({
    enum: TODOS_LOS_MOTIVOS,
    description:
      'Obligatorio al pasar a un estado terminal (CERRADO_GANADO/CERRADO_PERDIDO/DESCARTADO).',
  })
  @IsOptional()
  @IsIn(TODOS_LOS_MOTIVOS)
  motivoCierre?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Nota libre opcional sobre el cierre/descarte.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notaCierre?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description:
      'Nota de seguimiento al avanzar a un estado no terminal (calificado, visita, negociación, etc.).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notaTransicion?: string;

  @ApiPropertyOptional({
    description:
      'Datos estructurados según el estado destino (fecha de visita, inmueble, resultado, etc.). ' +
      'Ver GET /leads/pipeline/meta → camposAlEntrar por estado.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
