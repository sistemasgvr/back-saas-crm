import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { RUBROS_SOPORTADOS } from '../../../shared/domain/rubros-organizacion';

export class UpdateOrganizacionAdminDto {
  @ApiPropertyOptional({ example: 'Domaria Inmobiliaria', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({ example: 'domaria-inmobiliaria', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug debe ser minúsculas, números y guiones (ej. mi-empresa)',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: 'Domaria Inmobiliaria S.A.C.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  razonSocial?: string;

  @ApiPropertyOptional({ example: '20601234567', maxLength: 50 })
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

  @ApiPropertyOptional({ description: 'URL pública del logo' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'PE',
    minLength: 2,
    maxLength: 2,
    description: 'Código de país ISO 3166-1 alpha-2',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  pais?: string;

  @ApiPropertyOptional({
    example: 'America/Lima',
    maxLength: 64,
    description: 'Zona horaria IANA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  zonaHoraria?: string;

  @ApiPropertyOptional({
    description:
      'Notas internas de soporte/administración, no visibles para la organización',
  })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional({
    enum: RUBROS_SOPORTADOS,
    description: 'Rubro/vertical de negocio de la organización',
  })
  @IsOptional()
  @IsIn(RUBROS_SOPORTADOS)
  rubro?: string;
}
