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
  @IsString()
  @MaxLength(512)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'nombre debe ser minúsculas, números y guiones bajos (ej. primer_contacto)',
  })
  nombre: string;

  @IsIn(CATEGORIAS)
  categoria: (typeof CATEGORIAS)[number];

  @IsString()
  @MaxLength(10)
  idioma: string;

  @IsString()
  @MaxLength(1024)
  cuerpo: string;

  /** Un valor de ejemplo por cada {{n}} en `cuerpo`, en orden — Meta exige
   * ejemplos para revisar una plantilla con variables. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ejemplosCuerpo?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  encabezado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ejemploEncabezado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  pie?: string;
}
