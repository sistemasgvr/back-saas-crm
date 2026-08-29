import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateOrganizacionDto {
  @ApiPropertyOptional({ example: 'Domaria Inmobiliaria', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Domaria Inmobiliaria S.A.C.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  razonSocial?: string;

  @ApiPropertyOptional({
    example: '20601234567',
    description: 'RUC/NIT/CUIT según el país',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentoFiscal?: string;

  @ApiPropertyOptional({ example: 'contacto@domaria.pe', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailContacto?: string;

  @ApiPropertyOptional({ example: '+51987654321', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefonoContacto?: string;

  @ApiPropertyOptional({
    description: 'URL pública del logo de la organización',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'PE',
    description: 'Código de país ISO 3166-1 alpha-2',
    minLength: 2,
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  pais?: string;

  @ApiPropertyOptional({
    example: 'America/Lima',
    description: 'Zona horaria IANA',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  zonaHoraria?: string;
}
