import { IsIn, IsUUID } from 'class-validator';

export class AsignarOrganizacionDto {
  @IsUUID()
  organizacionId: string;

  @IsIn(['PROPIETARIO', 'ADMINISTRADOR', 'USUARIO'])
  rol: 'PROPIETARIO' | 'ADMINISTRADOR' | 'USUARIO';
}
