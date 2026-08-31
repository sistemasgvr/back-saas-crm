import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Multipart/form-data — el archivo en sí viaja como file, no en este DTO
 * (ver `@UploadedFile()` en el controller). */
export class SubirMediaDto {
  @ApiPropertyOptional({
    maxLength: 1024,
    description:
      'Texto que acompaña al archivo (no aplica a audio/sticker — Meta no lo admite ahí).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}
