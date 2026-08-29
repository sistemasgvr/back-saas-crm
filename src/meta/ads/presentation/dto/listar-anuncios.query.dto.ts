import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListarAnunciosQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por conjunto de anuncios (UUID interno)',
  })
  @IsOptional()
  @IsUUID()
  conjuntoAnuncioId?: string;
}
