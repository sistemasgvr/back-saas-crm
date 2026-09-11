import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenombrarConversacionDto {
  @ApiProperty({
    example: 'María Pérez',
    maxLength: 200,
    description: 'Nombre visible del contacto en el CRM (y del lead vinculado).',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre: string;
}
