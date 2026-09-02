import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ParametroPlantillaDto {
  @ApiProperty({
    description:
      'Nombre de la variable, tal como aparece en la plantilla (sin las llaves), ej. "nombre_cliente"',
    example: 'nombre_cliente',
  })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'nombre de variable inválido — minúsculas, números y guiones bajos, empezando con letra',
  })
  @MaxLength(60)
  nombre: string;

  @ApiProperty({
    description: 'Valor real a enviar para esa variable',
    example: 'Juan',
  })
  @IsString()
  @MaxLength(1024)
  valor: string;
}

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
    type: [ParametroPlantillaDto],
    description:
      'Nombre + valor de cada variable de la plantilla — el front los toma de GET /whatsapp/chats/templates.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ParametroPlantillaDto)
  parametros?: ParametroPlantillaDto[];

  @ApiPropertyOptional({
    enum: ['NAMED', 'POSITIONAL'],
    description:
      'Formato de parámetros de la plantilla elegida (campo `formatoParametros` de la plantilla). Por defecto NAMED — ' +
      'usar POSITIONAL solo para plantillas legacy creadas fuera de este CRM.',
  })
  @IsOptional()
  @IsIn(['NAMED', 'POSITIONAL'])
  plantillaFormatoParametros?: string;

  @ApiPropertyOptional({
    description:
      'Id propio del mensaje al que se responde/cita — "Responder" del chat. Solo aplica al texto de sesión.',
  })
  @IsOptional()
  @IsUUID()
  respondeAMensajeId?: string;
}
