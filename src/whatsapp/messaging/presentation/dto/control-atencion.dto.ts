import { IsInt, IsUUID, Min, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TomarControlDto {
  @ApiProperty({
    minimum: 0,
    description: 'Versión obtenida en GET :id/control',
  })
  @IsInt()
  @Min(0)
  controlVersion!: number;
}

export class TransferirControlDto extends TomarControlDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  usuarioId!: string;
}
export class AsumirHumanoDto extends TomarControlDto {
  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description: 'Asignado del lead observado al abrir la confirmación',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  asignadoUsuarioId!: string | null;
}
