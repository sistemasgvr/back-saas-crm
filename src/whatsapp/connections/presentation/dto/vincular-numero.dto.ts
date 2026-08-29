import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VincularNumeroDto {
  @ApiProperty({
    description: 'Id de la WhatsApp Business Account (WABA) en Meta',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  wabaId: string;

  @ApiProperty({
    description:
      'Id del número de teléfono en la Cloud API de WhatsApp (phone_number_id)',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  phoneNumberId: string;

  @ApiPropertyOptional({
    example: '+51987654321',
    description: 'Número en formato visible, para mostrar en la UI',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroDisplay?: string;

  @ApiPropertyOptional({
    description:
      'Nombre de perfil verificado en WhatsApp Business, si Meta lo expone',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombreVerificado?: string;
}
