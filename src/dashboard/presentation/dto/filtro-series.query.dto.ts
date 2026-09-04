import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class FiltroSeriesQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por campaña de Meta (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  campanaId?: string;

  @ApiPropertyOptional({
    description: 'Filtra por conjunto de anuncios (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  conjuntoAnuncioId?: string;

  @ApiPropertyOptional({ description: 'Filtra por anuncio (UUID interno)' })
  @IsOptional()
  @IsUUID()
  anuncioId?: string;

  @ApiPropertyOptional({
    description: 'Filtra por cuenta publicitaria de Meta (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  metaCuentaId?: string;

  @ApiPropertyOptional({
    description:
      'Filtra leads por inmueble de interés (`leads.inmueble_interes_id`, UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  inmuebleId?: string;

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
}
