import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';

export class ListarUsuariosQueryDto extends PaginacionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  estado?: 0 | 1;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  esAdminPlataforma?: 0 | 1;
}
