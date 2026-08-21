import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateOrganizacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

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
}
