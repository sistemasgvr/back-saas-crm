import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SdpDto {
  @ApiProperty({ description: 'SDP answer/offer WebRTC' })
  @IsString()
  sdp: string;
}

export class PresenciaLlamadasDto {
  @ApiProperty({ description: 'true = disponible para recibir llamadas' })
  @IsBoolean()
  disponible: boolean;
}

export class ActualizarLlamadaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notaPostLlamada?: string;

  @ApiPropertyOptional({
    description: 'seguimiento | visita | consulta | otro',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  motivo?: string;
}

export class IniciarLlamadaSalienteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversacionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  waId?: string;

  @ApiProperty({ description: 'SDP offer WebRTC' })
  @IsString()
  sdp: string;
}

export class SolicitarPermisoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversacionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  waId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  mensaje?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plantillaNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plantillaIdioma?: string;
}

export class ActualizarSettingsLlamadaDto {
  @ApiProperty()
  @IsString()
  conexionId: string;

  @ApiPropertyOptional({ description: 'ENABLED | DISABLED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callIconVisibility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  callHours?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callbackPermissionStatus?: string;
}
