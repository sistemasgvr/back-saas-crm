import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class EnviarReaccionDto {
  @ApiProperty({
    example: '👍',
    maxLength: 20,
    description:
      'Emoji a poner como reacción. Mandar string vacío ("") saca la reacción que ya estuviera puesta.',
  })
  @IsString()
  @MaxLength(20)
  emoji: string;
}
