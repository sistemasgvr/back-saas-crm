import { IsString, MaxLength } from 'class-validator';

export class VincularPaginaDto {
  @IsString()
  @MaxLength(64)
  pageId: string;

  @IsString()
  @MaxLength(200)
  pageNombre: string;
}
