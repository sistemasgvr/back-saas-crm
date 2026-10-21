import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ToggleModuloDto {
  @IsOptional()
  @IsBoolean()
  desactivarDependientes?: boolean;
  @ApiProperty({
    description:
      'true habilita el módulo para la organización, false lo deshabilita',
  })
  @IsBoolean()
  habilitado: boolean;
}
