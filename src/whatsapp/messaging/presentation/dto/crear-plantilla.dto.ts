import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const CATEGORIAS = ['AUTHENTICATION', 'MARKETING', 'UTILITY'] as const;

export class CrearPlantillaDto {
  @ApiProperty({
    example: 'primer_contacto_lead',
    maxLength: 512,
    description:
      'Nombre único de la plantilla en Meta, minúsculas/números/guiones bajos',
  })
  @IsString()
  @MaxLength(512)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'nombre debe ser minúsculas, números y guiones bajos (ej. primer_contacto)',
  })
  nombre: string;

  @ApiProperty({
    enum: CATEGORIAS,
    description: 'Categoría de la plantilla exigida por Meta',
  })
  @IsIn(CATEGORIAS)
  categoria: (typeof CATEGORIAS)[number];

  @ApiProperty({
    example: 'es',
    maxLength: 10,
    description:
      'Código de idioma de la plantilla (ej. "es", "es_PE", "en_US")',
  })
  @IsString()
  @MaxLength(10)
  idioma: string;

  @ApiProperty({
    example:
      'Hola {{1}}, gracias por tu interés en {{2}}. ¿En qué te podemos ayudar?',
    maxLength: 1024,
    description:
      'Texto del cuerpo del mensaje. Puede incluir variables posicionales {{1}}, {{2}}, … en orden secuencial.',
  })
  @IsString()
  @MaxLength(1024)
  cuerpo: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Juan', 'Domaria Torre Sur'],
    description:
      'Un valor de ejemplo por cada {{n}} en `cuerpo`, en el mismo orden — Meta exige un ejemplo por ' +
      'variable para revisar y aprobar la plantilla.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ejemplosCuerpo?: string[];

  @ApiPropertyOptional({
    example: '¡Hola {{1}}!',
    maxLength: 60,
    description:
      'Texto del encabezado (opcional). Admite como máximo una variable {{1}} — límite de Meta.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  encabezado?: string;

  @ApiPropertyOptional({
    example: 'Juan',
    maxLength: 60,
    description:
      'Valor de ejemplo para la variable {{1}} del encabezado, si `encabezado` la usa (requerido por Meta en ese caso).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ejemploEncabezado?: string;

  @ApiPropertyOptional({
    example: 'Domaria Inmobiliaria',
    maxLength: 60,
    description: 'Texto del pie de página (opcional, sin variables).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  pie?: string;
}
