import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class EnviarMensajeDto {
  @ApiPropertyOptional({
    maxLength: 4096,
    description:
      'Texto libre a enviar — solo válido si la conversación está dentro de la ventana de 24h del cliente.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  texto?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Nombre de una plantilla APPROVED — requerido para reabrir/iniciar fuera de la ventana de 24h.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  plantillaNombre?: string;

  @ApiPropertyOptional({
    example: 'es',
    maxLength: 20,
    description:
      'Idioma de la plantilla enviada (debe coincidir con el aprobado en Meta).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  plantillaIdioma?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Juan', 'Domaria Torre Sur'],
    description:
      'Valores para {{1}}, {{2}}… del cuerpo de la plantilla, en el mismo orden en que aparecen.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  parametros?: string[];
}
