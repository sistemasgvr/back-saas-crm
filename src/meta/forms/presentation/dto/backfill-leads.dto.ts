import { IsOptional, IsString, Matches } from 'class-validator';

export class BackfillLeadsDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'desde debe tener formato YYYY-MM-DD',
  })
  desde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'hasta debe tener formato YYYY-MM-DD',
  })
  hasta?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
