import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellido?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;
}
