import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ActualizarVisitaAgendaDto {
  @ApiPropertyOptional({ description: 'Nuevo inicio (ISO 8601) — reagendar' })
  @IsOptional()
  @IsDateString()
  programadaEn?: string;

  @ApiPropertyOptional({ description: 'Nueva duración en minutos (30–180)' })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  duracionMinutos?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  referenciaInmueble?: string;

  @ApiPropertyOptional({ enum: ['PRESENCIAL', 'VIRTUAL'] })
  @IsOptional()
  @IsIn(['PRESENCIAL', 'VIRTUAL'])
  modalidad?: string;

  @ApiPropertyOptional({
    enum: ['PROGRAMADA', 'REALIZADA', 'NO_SHOW', 'CANCELADA'],
  })
  @IsOptional()
  @IsIn(['PROGRAMADA', 'REALIZADA', 'NO_SHOW', 'CANCELADA'])
  estado?: string;

  @ApiPropertyOptional({
    enum: ['ASISTIO', 'NO_SHOW', 'CANCELADA'],
    description: 'Resultado al cerrar la visita',
  })
  @IsOptional()
  @IsIn(['ASISTIO', 'NO_SHOW', 'CANCELADA'])
  resultado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nota?: string;
}
