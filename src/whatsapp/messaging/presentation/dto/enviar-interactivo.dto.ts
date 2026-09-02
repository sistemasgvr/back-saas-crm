import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class BotonInteractivoDto {
  @ApiProperty({ maxLength: 256 })
  @IsString()
  @MaxLength(256)
  id: string;

  @ApiProperty({ maxLength: 20, example: 'Sí, me interesa' })
  @IsString()
  @MaxLength(20)
  titulo: string;
}

export class FilaListaDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  id: string;

  @ApiProperty({ maxLength: 24 })
  @IsString()
  @MaxLength(24)
  titulo: string;

  @ApiPropertyOptional({ maxLength: 72 })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  descripcion?: string;
}

export class SeccionListaDto {
  @ApiPropertyOptional({ maxLength: 24 })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  titulo?: string;

  @ApiProperty({ type: [FilaListaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FilaListaDto)
  filas: FilaListaDto[];
}

export class EnviarInteractivoDto {
  @ApiProperty({ enum: ['button', 'list', 'cta_url', 'location_request'] })
  @IsIn(['button', 'list', 'cta_url', 'location_request'])
  subtipo: 'button' | 'list' | 'cta_url' | 'location_request';

  @ApiProperty({ maxLength: 1024 })
  @IsString()
  @MaxLength(1024)
  cuerpo: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  pie?: string;

  @ApiPropertyOptional({
    type: [BotonInteractivoDto],
    description: 'Solo subtipo "button" — hasta 3.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => BotonInteractivoDto)
  botones?: BotonInteractivoDto[];

  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Solo subtipo "list" — etiqueta del botón que abre el picker.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  botonLista?: string;

  @ApiPropertyOptional({
    type: [SeccionListaDto],
    description:
      'Solo subtipo "list" — hasta 10 filas en total entre todas las secciones.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SeccionListaDto)
  secciones?: SeccionListaDto[];

  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Solo subtipo "cta_url".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  textoBoton?: string;

  @ApiPropertyOptional({ description: 'Solo subtipo "cta_url".' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({
    description: 'Id propio del mensaje al que se responde/cita.',
  })
  @IsOptional()
  @IsUUID()
  respondeAMensajeId?: string;
}
