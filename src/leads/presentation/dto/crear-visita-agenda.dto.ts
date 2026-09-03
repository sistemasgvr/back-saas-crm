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

export class CrearVisitaAgendaDto {
  @ApiProperty({ description: 'Lead al que se asocia la visita' })
  @IsUUID()
  leadId: string;

  @ApiProperty({ description: 'Inicio de la visita (ISO 8601)' })
  @IsDateString()
  programadaEn: string;

  @ApiPropertyOptional({
    description: 'Duración en minutos (30–180). Default 60.',
    default: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  duracionMinutos?: number;

  @ApiProperty({ description: 'Inmueble o proyecto de referencia' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  referenciaInmueble: string;

  @ApiPropertyOptional({
    enum: ['PRESENCIAL', 'VIRTUAL'],
    default: 'PRESENCIAL',
  })
  @IsOptional()
  @IsIn(['PRESENCIAL', 'VIRTUAL'])
  modalidad?: string;

  @ApiPropertyOptional({ description: 'Nota interna de la cita' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nota?: string;

  @ApiPropertyOptional({
    description:
      'Asesor responsable (solo admin). Si se omite: asignado del lead o el usuario actual.',
  })
  @IsOptional()
  @IsUUID()
  asignadoUsuarioId?: string;
}
