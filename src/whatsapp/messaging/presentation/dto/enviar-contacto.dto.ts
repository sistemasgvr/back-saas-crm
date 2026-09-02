import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TelefonoContactoDto {
  @ApiProperty({ example: '+51987654321' })
  @IsString()
  @MaxLength(30)
  numero: string;

  @ApiPropertyOptional({
    example: 'CELL',
    description: 'Etiqueta libre (CELL, WORK, HOME…) — opcional.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tipo?: string;
}

export class ContactoDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MaxLength(200)
  nombre: string;

  @ApiProperty({ type: [TelefonoContactoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TelefonoContactoDto)
  telefonos: TelefonoContactoDto[];

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizacion?: string;
}

export class EnviarContactoDto {
  @ApiProperty({
    type: [ContactoDto],
    description:
      'Uno o más contactos — WhatsApp admite mandar varios en un mismo mensaje.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactoDto)
  contactos: ContactoDto[];

  @ApiPropertyOptional({
    description: 'Id propio del mensaje al que se responde/cita.',
  })
  @IsOptional()
  @IsUUID()
  respondeAMensajeId?: string;
}
