import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PatchFeaturePermisoDto {
  @ApiProperty({
    description:
      'Id del feature/permiso opcional de Meta (ver matriz en meta-permisos-matriz.ts), ej. "whatsapp_management"',
  })
  @IsNotEmpty()
  @IsString()
  featureId!: string;

  @ApiProperty({
    description:
      'true para activar el feature (pide el scope si falta), false para desactivarlo',
  })
  @IsBoolean()
  deseada!: boolean;

  @ApiPropertyOptional({
    description:
      'Si es true y se desactiva, además intenta revocar el scope ya otorgado en Meta',
  })
  @IsOptional()
  @IsBoolean()
  revocarEnMeta?: boolean;
}
