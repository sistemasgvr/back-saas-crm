import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VincularPaginaDto {
  @ApiProperty({
    description:
      'Id de la página de Facebook en Meta (page_id), tomado de GET /meta/connections/pages',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  pageId: string;

  @ApiProperty({
    description:
      'Nombre de la página, para mostrar en la UI sin volver a consultar Graph API',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  pageNombre: string;
}
