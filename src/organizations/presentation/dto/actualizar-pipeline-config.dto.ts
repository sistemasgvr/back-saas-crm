import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

/**
 * PATCH body: `{ "config": { COMPRA, VENTA, OTRO } }` o `{ "config": null }`
 * para restaurar matrices de código.
 *
 * La validación de forma vive en dominio (`validarPipelineConfig`); el DTO
 * solo acepta el campo.
 */
export class ActualizarPipelineConfigDto {
  @ApiProperty({
    nullable: true,
    description:
      'Override completo (COMPRA/VENTA/OTRO con estados + transiciones). ' +
      'null restaura los defaults de código.',
  })
  @Allow()
  config: unknown | null;
}
