import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AsignarLeadDto {
  @ApiProperty({
    description:
      'Id del usuario (miembro de la organización) al que se asigna el lead',
  })
  @IsUUID()
  usuarioId: string;
}
