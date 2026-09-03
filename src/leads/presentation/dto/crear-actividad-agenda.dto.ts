import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearActividadAgendaDto {
  @ApiProperty({ description: 'Lead asociado' })
  @IsUUID()
  leadId: string;

  @ApiProperty({
    enum: ['VISITA', 'LLAMADA', 'REUNION', 'SEGUIMIENTO', 'OTRO'],
  })
  @IsIn(['VISITA', 'LLAMADA', 'REUNION', 'SEGUIMIENTO', 'OTRO'])
  tipo: string;

  @ApiPropertyOptional({ description: 'Título (si se omite, se genera según el tipo)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @ApiProperty({ description: 'Inicio (ISO 8601)' })
  @IsDateString()
  programadaEn: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  duracionMinutos?: number;

  @ApiPropertyOptional({ description: 'Requerido si tipo = VISITA' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  referenciaInmueble?: string;

  @ApiPropertyOptional({ enum: ['PRESENCIAL', 'VIRTUAL'] })
  @IsOptional()
  @IsIn(['PRESENCIAL', 'VIRTUAL'])
  modalidad?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nota?: string;

  @ApiPropertyOptional({ description: 'Asesor (solo admin)' })
  @IsOptional()
  @IsUUID()
  asignadoUsuarioId?: string;
}
