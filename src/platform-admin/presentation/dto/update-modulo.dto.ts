import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateModuloDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

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
