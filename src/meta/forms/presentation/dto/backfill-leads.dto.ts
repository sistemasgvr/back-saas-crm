import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class BackfillLeadsDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Fecha de inicio del rango a reimportar, formato YYYY-MM-DD (por defecto, sin límite)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'desde debe tener formato YYYY-MM-DD',
  })
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-08-29',
    description:
      'Fecha de fin del rango a reimportar, formato YYYY-MM-DD (por defecto, hasta hoy)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'hasta debe tener formato YYYY-MM-DD',
  })
  hasta?: string;

  @ApiPropertyOptional({
    description:
      'Cursor de paginación de Graph API devuelto por una llamada anterior — se usa para continuar un ' +
      'backfill grande en varias tandas sin reprocesar leads ya traídos',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
