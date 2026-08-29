import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';

export class ListarUsuariosQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda libre por nombre, apellido o email',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    enum: [0, 1],
    description: '0 = inactivo, 1 = activo',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  estado?: 0 | 1;

  @ApiPropertyOptional({
    enum: [0, 1],
    description: 'Filtra solo admins de plataforma (1) o solo no-admins (0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  esAdminPlataforma?: 0 | 1;
}
