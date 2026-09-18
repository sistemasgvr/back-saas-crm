import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class ActualizarRolLineaDto {
  @ApiProperty({
    enum: ['MENSAJES', 'LLAMADAS', 'AMBOS'],
    description:
      'MENSAJES = chats/coexistencia; LLAMADAS = Cloud Calling; AMBOS = messaging+calling Cloud-only',
  })
  @IsString()
  @IsIn(['MENSAJES', 'LLAMADAS', 'AMBOS'])
  rolLinea: string;
}
