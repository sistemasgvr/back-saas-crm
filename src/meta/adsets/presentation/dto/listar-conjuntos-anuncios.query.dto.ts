import { IsOptional, IsUUID } from 'class-validator';

export class ListarConjuntosAnunciosQueryDto {
  @IsOptional()
  @IsUUID()
  campanaId?: string;
}
