import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ESTADOS_INMUEBLE,
  OPERACIONES_INMUEBLE,
  TIPOS_INMUEBLE,
} from '../../../shared/domain/inmuebles-catalogo';

export class ActualizarInmuebleDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  codigo?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo?: string;

  @ApiPropertyOptional({ enum: TIPOS_INMUEBLE })
  @IsOptional()
  @IsIn([...TIPOS_INMUEBLE])
  tipo?: string;

  @ApiPropertyOptional({ enum: OPERACIONES_INMUEBLE })
  @IsOptional()
  @IsIn([...OPERACIONES_INMUEBLE])
  operacion?: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  zona?: string | null;

  @ApiPropertyOptional({ maxLength: 300, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(300)
  direccion?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio?: number | null;

  @ApiPropertyOptional({ example: 'PEN' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  moneda?: string;

  @ApiPropertyOptional({ enum: ESTADOS_INMUEBLE })
  @IsOptional()
  @IsIn([...ESTADOS_INMUEBLE])
  estadoInmueble?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(5000)
  notas?: string | null;
}
