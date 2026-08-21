import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VincularNumeroDto {
  @IsString()
  @MaxLength(64)
  wabaId: string;

  @IsString()
  @MaxLength(64)
  phoneNumberId: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroDisplay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombreVerificado?: string;
}
