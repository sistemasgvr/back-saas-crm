import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateModuloDto {
  @ApiProperty({
    example: 'WHATSAPP',
    maxLength: 50,
    description:
      'Código único del módulo, MAYÚSCULAS_CON_GUION_BAJO (usado como llave de activación por organización)',
  })
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'codigo debe ser MAYUSCULAS_CON_GUION_BAJO',
  })
  codigo: string;

  @ApiProperty({ example: 'WhatsApp', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción visible en el panel de administración',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    example: 'mdi:whatsapp',
    maxLength: 80,
    description: 'Nombre del ícono (mismo set usado en el front)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  icono?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 999,
    description: 'Orden de aparición en los listados',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;
}
