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

export class ActualizarActividadAgendaDto {
  @ApiPropertyOptional({
    enum: ['VISITA', 'LLAMADA', 'REUNION', 'SEGUIMIENTO', 'OTRO'],
  })
  @IsOptional()
  @IsIn(['VISITA', 'LLAMADA', 'REUNION', 'SEGUIMIENTO', 'OTRO'])
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  programadaEn?: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({ enum: ['PROGRAMADA', 'COMPLETADA', 'CANCELADA'] })
  @IsOptional()
  @IsIn(['PROGRAMADA', 'COMPLETADA', 'CANCELADA'])
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nota?: string;
}
