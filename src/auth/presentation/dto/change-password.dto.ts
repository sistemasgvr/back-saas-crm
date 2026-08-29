import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual del usuario, para confirmar identidad',
  })
  @IsString()
  @MinLength(1)
  passwordActual: string;

  @ApiProperty({
    description: 'Nueva contraseña, mínimo 8 caracteres',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  passwordNueva: string;
}
