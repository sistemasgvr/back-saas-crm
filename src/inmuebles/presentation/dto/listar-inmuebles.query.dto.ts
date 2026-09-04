import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionQueryDto } from '../../../shared/presentation/dto/paginacion.query.dto';
import {
  ESTADOS_INMUEBLE,
  OPERACIONES_INMUEBLE,
  TIPOS_INMUEBLE,
} from '../../../shared/domain/inmuebles-catalogo';

export class ListarInmueblesQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda por código, título, zona o dirección',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: TIPOS_INMUEBLE })
  @IsOptional()
  @IsIn([...TIPOS_INMUEBLE])
  tipo?: string;

  @ApiPropertyOptional({ enum: OPERACIONES_INMUEBLE })
  @IsOptional()
  @IsIn([...OPERACIONES_INMUEBLE])
  operacion?: string;

  @ApiPropertyOptional({ enum: ESTADOS_INMUEBLE })
  @IsOptional()
  @IsIn([...ESTADOS_INMUEBLE])
  estadoInmueble?: string;

  @ApiPropertyOptional({ description: 'Filtra por zona (contiene)', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  zona?: string;
}
