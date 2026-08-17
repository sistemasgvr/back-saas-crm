import { IsOptional, IsUUID } from 'class-validator';

export class ListarAnunciosQueryDto {
  @IsOptional()
  @IsUUID()
  conjuntoAnuncioId?: string;
}
