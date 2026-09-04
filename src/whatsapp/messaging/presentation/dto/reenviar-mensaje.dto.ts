import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Tope alineado con el multi-forward de la app WhatsApp (~30). */
export const MAX_MENSAJES_REENVIAR = 30;

export class ReenviarMensajeDto {
  @ApiProperty({ description: 'Conversación destino del reenvío' })
  @IsUUID()
  conversacionDestinoId!: string;
}

export class ReenviarMensajesLoteDto {
  @ApiProperty({ description: 'Conversación destino del reenvío' })
  @IsUUID()
  conversacionDestinoId!: string;

  @ApiProperty({
    description: `IDs de mensajes a reenviar (1–${MAX_MENSAJES_REENVIAR}), en orden`,
    type: [String],
    maxItems: MAX_MENSAJES_REENVIAR,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MENSAJES_REENVIAR)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mensajeIds!: string[];
}

export class ReenviarMensajesLoteResultadoDto {
  @ApiProperty()
  enviados!: number;

  @ApiPropertyOptional({
    description: 'Fallos parciales (el resto sí se envió)',
    type: 'array',
  })
  fallidos!: { mensajeId: string; error: string }[];
}
