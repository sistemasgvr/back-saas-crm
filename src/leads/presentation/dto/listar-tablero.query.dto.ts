import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';

export class ListarTableroQueryDto extends PaginacionQueryDto {
  @IsOptional() @IsString() @MaxLength(255) q?: string;
}
