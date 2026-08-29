import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VincularCuentaDto {
  @ApiProperty({
    description:
      'Id de la cuenta publicitaria en Meta (act_...), tomado de GET /meta/connections/ad-accounts',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  adAccountId: string;

  @ApiProperty({
    description:
      'Nombre de la cuenta, para mostrar en la UI sin volver a consultar Graph API',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  adAccountNombre: string;
}
