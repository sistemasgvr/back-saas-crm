import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';

export class ListarOrganizacionesQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda libre por nombre, slug o documento fiscal',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    enum: [0, 1],
    description: '0 = inactiva, 1 = activa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  estado?: 0 | 1;
}
