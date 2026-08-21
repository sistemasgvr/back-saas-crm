import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EnviarMensajeDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  texto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  plantillaNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  plantillaIdioma?: string;
}
