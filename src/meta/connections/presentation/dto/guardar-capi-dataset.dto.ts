import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GuardarCapiDatasetDto {
  @ApiPropertyOptional({
    description:
      'Id del dataset de Meta Events Manager dedicado a eventos CRM (Conversion Leads). Omitir o mandar ' +
      'vacío desactiva el envío de eventos para esta organización.',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  capiDatasetId?: string;
}
