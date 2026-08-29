import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Juan', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Pérez', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellido?: string;

  @ApiPropertyOptional({ example: '+51987654321', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;
}
