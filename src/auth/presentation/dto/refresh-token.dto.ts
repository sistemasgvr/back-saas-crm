import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token emitido en el login o en un refresh anterior',
  })
  @IsString()
  refreshToken: string;
}
