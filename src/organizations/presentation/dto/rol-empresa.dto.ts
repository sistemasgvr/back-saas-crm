import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TODOS_LOS_PERMISOS } from '../../../shared/domain/permisos';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearRolEmpresaDto {
  @ApiProperty({ example: 'Supervisor' })
  @Transform(recortar)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({ type: [String], example: ['leads.ver', 'leads.ver_todos'] })
  @IsArray()
  @ArrayMaxSize(TODOS_LOS_PERMISOS.length)
  @IsIn(TODOS_LOS_PERMISOS, { each: true })
  permisos!: string[];
}

export class ActualizarRolEmpresaDto {
  @ApiPropertyOptional()
  @ValidateIf((_obj, value) => value !== undefined)
  @Transform(recortar)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TODOS_LOS_PERMISOS.length)
  @IsIn(TODOS_LOS_PERMISOS, { each: true })
  permisos?: string[];
}
