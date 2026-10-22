import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';

export class EditarUsuarioEmpresaDto {
  @ValidateIf((_obj, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellido?: string;
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;
  @ValidateIf((_obj, value) => value !== undefined)
  @IsIn(['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'])
  rol?: RolOrganizacion;
}
export class CrearUsuarioEmpresaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellido?: string;
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;
  @IsIn(['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'])
  rol!: RolOrganizacion;
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
export class EstadoUsuarioEmpresaDto {
  @IsInt() @IsIn([0, 1]) estado!: 0 | 1;
}
export class PasswordTemporalDto {
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
}
export class ReasignarLeadsUsuarioDto {
  @IsUUID() destinoUsuarioId!: string;
}
