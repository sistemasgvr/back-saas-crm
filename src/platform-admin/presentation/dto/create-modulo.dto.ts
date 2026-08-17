import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateModuloDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, { message: 'codigo debe ser MAYUSCULAS_CON_GUION_BAJO' })
  codigo: string;

  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icono?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;
}
