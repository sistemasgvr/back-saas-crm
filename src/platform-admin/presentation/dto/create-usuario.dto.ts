import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class AsignacionInicialDto {
  @IsUUID()
  organizacionId: string;

  @IsIn(['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'])
  rol: 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO';
}

export class CreateUsuarioDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellido?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  esAdminPlataforma?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AsignacionInicialDto)
  asignacion?: AsignacionInicialDto;
}
