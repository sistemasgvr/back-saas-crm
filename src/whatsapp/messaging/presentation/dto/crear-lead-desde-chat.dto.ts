import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearLeadDesdeChatDto {
  @ApiPropertyOptional({
    description: 'Nombre del lead (por defecto el nombre de contacto de WhatsApp)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'Teléfono (por defecto el waId del chat, con +)',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @ApiPropertyOptional({
    enum: ['COMPRA', 'VENTA', 'OTRO'],
    description: 'Clasificación inmobiliaria opcional',
  })
  @IsOptional()
  @IsIn(['COMPRA', 'VENTA', 'OTRO'])
  tipoLead?: string;
}
