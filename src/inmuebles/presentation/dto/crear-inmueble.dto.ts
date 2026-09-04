import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ESTADOS_INMUEBLE,
  OPERACIONES_INMUEBLE,
  TIPOS_INMUEBLE,
} from '../../../shared/domain/inmuebles-catalogo';

export class CrearInmuebleDto {
  @ApiProperty({ example: 'DOM-101', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  codigo: string;

  @ApiProperty({ example: 'Departamento Torre A 101', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo: string;

  @ApiProperty({ enum: TIPOS_INMUEBLE })
  @IsIn([...TIPOS_INMUEBLE])
  tipo: string;

  @ApiProperty({ enum: OPERACIONES_INMUEBLE })
  @IsIn([...OPERACIONES_INMUEBLE])
  operacion: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  zona?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  direccion?: string;

  @ApiPropertyOptional({ example: 185000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio?: number;

  @ApiPropertyOptional({ example: 'PEN', default: 'PEN' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  moneda?: string;

  @ApiPropertyOptional({
    enum: ESTADOS_INMUEBLE,
    default: 'DISPONIBLE',
  })
  @IsOptional()
  @IsIn([...ESTADOS_INMUEBLE])
  estadoInmueble?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notas?: string;
}
