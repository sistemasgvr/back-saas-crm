import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListarConjuntosAnunciosQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por campaña de Meta (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  campanaId?: string;
}
