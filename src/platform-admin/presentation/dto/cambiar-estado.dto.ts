import { IsIn } from 'class-validator';

export class CambiarEstadoDto {
  @IsIn([0, 1])
  estado: 0 | 1;
}
