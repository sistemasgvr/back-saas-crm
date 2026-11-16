import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AsesorEsperadoDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Asesor que mostraba el lead al iniciar el cambio',
  })
  @IsOptional()
  @IsUUID()
  asesorEsperadoId?: string | null;
}

export class AsignarLeadDto extends AsesorEsperadoDto {
  @ApiProperty({
    description:
      'Id del usuario (miembro de la organización) al que se asigna el lead',
  })
  @IsUUID()
  usuarioId: string;
}
