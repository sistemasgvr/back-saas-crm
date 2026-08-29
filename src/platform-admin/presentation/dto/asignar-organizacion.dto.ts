import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class AsignarOrganizacionDto {
  @ApiProperty({ description: 'Organización a la que se asigna el usuario' })
  @IsUUID()
  organizacionId: string;

  @ApiProperty({ enum: ['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'] })
  @IsIn(['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'])
  rol: 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO';
}
