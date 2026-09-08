import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Tope alineado con el multi-forward de la app WhatsApp (~30). */
export const MAX_MENSAJES_REENVIAR = 30;

/** Tope de chats destino por reenvío (WhatsApp multi-forward típico: 5). */
export const MAX_DESTINOS_REENVIAR = 5;

export class ReenviarMensajeDto {
  @ApiProperty({ description: 'Conversación destino del reenvío' })
  @IsUUID()
  conversacionDestinoId!: string;
}

export class ReenviarMensajesLoteDto {
  @ApiPropertyOptional({
    description:
      'Compat. Un solo destino. Preferir conversacionDestinoIds para varios chats.',
  })
  @ValidateIf((o: ReenviarMensajesLoteDto) => !o.conversacionDestinoIds?.length)
  @IsUUID()
  conversacionDestinoId?: string;

  @ApiPropertyOptional({
    description: `IDs de chats destino (1–${MAX_DESTINOS_REENVIAR}), cada uno dentro de ventana 24h`,
    type: [String],
    maxItems: MAX_DESTINOS_REENVIAR,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DESTINOS_REENVIAR)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  conversacionDestinoIds?: string[];

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
  fallidos!: {
    conversacionDestinoId: string;
    mensajeId: string;
    error: string;
  }[];
}
