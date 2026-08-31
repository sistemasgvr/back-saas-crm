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
    description:
      'Categoría exigida por Meta: AUTHENTICATION (códigos OTP), MARKETING (promociones/retargeting) o ' +
      'UTILITY (seguimiento de una acción del usuario — confirmaciones, alertas de cuenta).',
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
      'Hola {{nombre_cliente}}, gracias por tu interés en {{nombre_proyecto}}. ¿En qué te podemos ayudar?',
    maxLength: 1024,
    description:
      'Texto del cuerpo del mensaje. Puede incluir variables CON NOMBRE {{nombre_cliente}}, {{numero_pedido}}… ' +
      '(minúsculas, números y guiones bajos, empezando con letra) — el nombre le dice a quien crea la plantilla ' +
      'qué valor va ahí, sin tener que adivinar qué es {{1}} o {{2}}.',
  })
  @IsString()
  @MaxLength(1024)
  cuerpo: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Juan', 'Torre Sur'],
    description:
      'Un valor de ejemplo por cada variable de `cuerpo`, en el mismo orden en que aparecen por primera vez ' +
      '(no por nombre) — Meta exige un ejemplo por variable para revisar y aprobar la plantilla.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ejemplosCuerpo?: string[];

  @ApiPropertyOptional({
    example: '¡Hola {{nombre_cliente}}!',
    maxLength: 60,
    description:
      'Texto del encabezado (opcional). Admite como máximo una variable con nombre — límite de Meta.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  encabezado?: string;

  @ApiPropertyOptional({
    example: 'Juan',
    maxLength: 60,
    description:
      'Valor de ejemplo para la variable del encabezado, si `encabezado` tiene una (requerido por Meta en ese caso).',
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
