import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class AsignacionInicialDto {
  @ApiProperty({ description: 'Organización a la que se asigna el usuario' })
  @IsUUID()
  organizacionId: string;

  @ApiProperty({ enum: ['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'] })
  @IsIn(['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'])
  rol: 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO';
}

export class CreateUsuarioDto {
  @ApiProperty({ example: 'usuario@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Juan', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nombre: string;

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

  @ApiPropertyOptional({
    description:
      'Si es true, el usuario tiene acceso al panel de administración de plataforma (super-admin)',
  })
  @IsOptional()
  @IsBoolean()
  esAdminPlataforma?: boolean;

  @ApiPropertyOptional({
    type: AsignacionInicialDto,
    description:
      'Si se envía, asigna al usuario a una organización con ese rol al crearlo',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AsignacionInicialDto)
  asignacion?: AsignacionInicialDto;
}
