import { IsOptional, IsUUID } from 'class-validator';

export class FiltroDashboardQueryDto {
  @IsOptional()
  @IsUUID()
  campanaId?: string;

  @IsOptional()
  @IsUUID()
  conjuntoAnuncioId?: string;

  @IsOptional()
  @IsUUID()
  anuncioId?: string;
}
