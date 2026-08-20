import { IsNotEmpty, Matches } from 'class-validator';

export class SincronizarInsightsDto {
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'desde debe tener formato YYYY-MM-DD',
  })
  desde!: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'hasta debe tener formato YYYY-MM-DD',
  })
  hasta!: string;
}
