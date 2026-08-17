import { IsBoolean } from 'class-validator';

export class ToggleModuloDto {
  @IsBoolean()
  habilitado: boolean;
}
