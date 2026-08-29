import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';

export class ListarLeadsQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda libre por nombre, email o teléfono del lead',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtra por campaña de Meta (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  campanaId?: string;

  @ApiPropertyOptional({
    description: 'Filtra por anuncio de Meta (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  anuncioId?: string;

  @ApiPropertyOptional({
    description: 'Filtra por página de Facebook (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  metaPaginaId?: string;

  @ApiPropertyOptional({
    description: 'Filtra por cuenta publicitaria de Meta (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  metaCuentaId?: string;

  @ApiPropertyOptional({
    description:
      'Filtra por el id del formulario de Lead Ads en Meta (no es UUID interno)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  formularioId?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Fecha de inicio del rango, formato YYYY-MM-DD',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDesde debe tener formato YYYY-MM-DD',
  })
  fechaDesde?: string;

  @ApiPropertyOptional({
    example: '2026-08-29',
    description: 'Fecha de fin del rango, formato YYYY-MM-DD',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaHasta debe tener formato YYYY-MM-DD',
  })
  fechaHasta?: string;

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
