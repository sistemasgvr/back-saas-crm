import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TIPOS_LEAD_INMOBILIARIA } from '../../../shared/domain/tipos-lead-inmobiliaria';

export class ActualizarTipoLeadDto {
  @ApiProperty({
    enum: TIPOS_LEAD_INMOBILIARIA,
    description:
      'Intención comercial del lead (solo aplica al rubro INMOBILIARIA por ahora)',
  })
  @IsIn(TIPOS_LEAD_INMOBILIARIA)
  tipoLead: string;
}
