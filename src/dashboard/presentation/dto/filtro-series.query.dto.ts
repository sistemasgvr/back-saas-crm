import { IsOptional, IsUUID, Matches } from 'class-validator';

export class FiltroSeriesQueryDto {
  @IsOptional()
  @IsUUID()
  campanaId?: string;

  @IsOptional()
  @IsUUID()
  conjuntoAnuncioId?: string;

  @IsOptional()
  @IsUUID()
  anuncioId?: string;

  @IsOptional()
  @IsUUID()
  metaCuentaId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaDesde debe tener formato YYYY-MM-DD',
  })
  fechaDesde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaHasta debe tener formato YYYY-MM-DD',
  })
  fechaHasta?: string;
}
