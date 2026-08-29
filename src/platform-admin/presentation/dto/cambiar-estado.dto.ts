import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CambiarEstadoDto {
  @ApiProperty({
    enum: [0, 1],
    description: '0 = inactivo/deshabilitado, 1 = activo/habilitado',
  })
  @IsIn([0, 1])
  estado: 0 | 1;
}
