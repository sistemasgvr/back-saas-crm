import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GuardarCredencialesDto {
  @ApiProperty({
    description: 'App ID de la app de Meta for Developers de la organización',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  appId: string;

  @ApiProperty({
    description: 'App Secret de la app de Meta — se cifra antes de persistir',
    minLength: 10,
    maxLength: 200,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  appSecret: string;
}
