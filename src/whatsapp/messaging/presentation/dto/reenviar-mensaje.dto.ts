import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReenviarMensajeDto {
  @ApiProperty({ description: 'Conversación destino del reenvío' })
  @IsUUID()
  conversacionDestinoId!: string;
}
