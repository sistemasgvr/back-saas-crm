import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';

export class ListarUsuariosEmpresaQueryDto extends PaginacionQueryDto {
  @IsOptional() @IsString() @MaxLength(255) q?: string;
  @IsOptional()
  @IsIn(['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'])
  rol?: 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO';
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'suspendido'])
  estado?: 'activo' | 'inactivo' | 'suspendido';
}
