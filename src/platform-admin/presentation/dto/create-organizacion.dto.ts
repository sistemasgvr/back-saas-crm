import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class PrimerUsuarioDto {
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
}

export class CreateOrganizacionDto {
  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug debe ser minúsculas, números y guiones (ej. mi-empresa)',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentoFiscal?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailContacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefonoContacto?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  pais?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  zonaHoraria?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrimerUsuarioDto)
  primerUsuario?: PrimerUsuarioDto;
}
