import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TIPOS_LEAD_INMOBILIARIA } from '../../../shared/domain/tipos-lead-inmobiliaria';
import { FiltroSeriesQueryDto } from './filtro-series.query.dto';

export class FiltroEmbudoQueryDto extends FiltroSeriesQueryDto {
  @ApiPropertyOptional({
    enum: TIPOS_LEAD_INMOBILIARIA,
    description: 'Filtra por intención (Compra/Venta/Otro).',
  })
  @IsOptional()
  @IsIn(TIPOS_LEAD_INMOBILIARIA)
  tipoLead?: string;

  @ApiPropertyOptional({
    description:
      '"mios" (asignados a mí), "sin_asignar", o el UUID de un usuario puntual',
    example: 'mios',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  asignado?: string;
}
