import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class SincronizarInsightsDto {
  @ApiProperty({
    example: '2026-08-01',
    description: 'Fecha de inicio del rango a sincronizar, formato YYYY-MM-DD',
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'desde debe tener formato YYYY-MM-DD',
  })
  desde!: string;

  @ApiProperty({
    example: '2026-08-29',
    description: 'Fecha de fin del rango a sincronizar, formato YYYY-MM-DD',
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'hasta debe tener formato YYYY-MM-DD',
  })
  hasta!: string;
}
