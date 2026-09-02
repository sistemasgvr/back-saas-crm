import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class EnviarUbicacionDto {
  @ApiProperty({
    example: -12.046374,
    description: 'Latitud del punto a compartir.',
  })
  @IsLatitude()
  latitud: number;

  @ApiProperty({
    example: -77.042793,
    description: 'Longitud del punto a compartir.',
  })
  @IsLongitude()
  longitud: number;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Nombre del lugar (ej. el nombre de un negocio) — opcional.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Dirección del lugar — opcional.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  direccion?: string;

  @ApiPropertyOptional({
    description: 'Id propio del mensaje al que se responde/cita.',
  })
  @IsOptional()
  @IsUUID()
  respondeAMensajeId?: string;
}
