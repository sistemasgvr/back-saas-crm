import { IsString, MaxLength } from 'class-validator';

export class VincularCuentaDto {
  @IsString()
  @MaxLength(64)
  adAccountId: string;

  @IsString()
  @MaxLength(200)
  adAccountNombre: string;
}
