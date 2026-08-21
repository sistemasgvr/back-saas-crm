import { IsUUID } from 'class-validator';

export class AsignarLeadDto {
  @IsUUID()
  usuarioId: string;
}
