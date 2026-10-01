import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsUUID,
  IsObject,
  IsOptional,
} from 'class-validator';

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
    example: [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  usuarioIds: string[];

  @ApiProperty({
    required: false,
    description:
      'Máximo diario por usuario. Omitir un usuario significa sin límite.',
  })
  @IsOptional()
  @IsObject()
  limitesDiarios?: Record<string, number>;
}
