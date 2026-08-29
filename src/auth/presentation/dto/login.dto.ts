import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'usuario@empresa.com',
    description: 'Email registrado del usuario',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'MiClaveSegura123',
    description: 'Contraseña en texto plano',
  })
  @IsString()
  @MinLength(1)
  password: string;
}
