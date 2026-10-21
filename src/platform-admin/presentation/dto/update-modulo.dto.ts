import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayUnique,
  IsUUID,
  ValidateIf,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateModuloDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  grupoId?: string;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  requiere?: string[];

  @ApiPropertyOptional({ example: 'WhatsApp', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

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
