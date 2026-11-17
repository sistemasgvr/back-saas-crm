import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';
import { SubirMediaDto } from './subir-media.dto';

export class PrepararCargaDirectaMediaDto {
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  tamanoBytes!: number;
}

export class ConfirmarCargaDirectaMediaDto extends SubirMediaDto {
  @IsString()
  @Matches(/^\d{13}-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.[a-f0-9]{64}$/)
  cargaId!: string;

  @IsString()
  @MaxLength(255)
  nombreArchivo!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  tamanoBytes!: number;
}
