import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsUUID } from 'class-validator';

export class AutoAsignacionLeadsConfigDto {
  @ApiProperty({
    description:
      'Habilita/deshabilita el auto-reparto secuencial para los leads recién creados.',
  })
  @IsBoolean()
  habilitado: boolean;

  @ApiProperty({
    description:
      'IDs de usuarios del round-robin (ej. ["DavidId","DaimlerId","..."]). ' +
      'El índice del siguiente lead se alterna en forma circular (N usuarios).',
    type: [String],
    example: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID(undefined, { each: true })
  usuarioIds: string[];
}

