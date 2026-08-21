import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

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

  /** Valores para {{1}}, {{2}}… del BODY de la plantilla, en orden. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  parametros?: string[];
}
