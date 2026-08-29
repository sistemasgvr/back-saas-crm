import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class FiltroDashboardQueryDto {
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
}
