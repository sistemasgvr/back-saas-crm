import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../../shared/presentation/dto/paginacion.query.dto';

export class ListarChatsQueryDto extends PaginacionQueryDto {
  @IsOptional() @IsIn(['todos', 'mios']) asignado?: string;
  @IsOptional() @IsString() @MaxLength(255) q?: string;
  // IDs cuyos borradores locales coinciden con q. El repositorio aplica organización y visibilidad.
  @IsOptional() @IsString() @MaxLength(3700) borradores?: string;
}
