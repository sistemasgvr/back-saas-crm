import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleModuloDto {
  @ApiProperty({
    description:
      'true habilita el módulo para la organización, false lo deshabilita',
  })
  @IsBoolean()
  habilitado: boolean;
}
