import { IsString, MaxLength, MinLength } from 'class-validator';

export class GuardarCredencialesDto {
  @IsString()
  @MaxLength(64)
  appId: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  appSecret: string;
}
