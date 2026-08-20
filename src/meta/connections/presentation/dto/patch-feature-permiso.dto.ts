import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PatchFeaturePermisoDto {
  @IsNotEmpty()
  @IsString()
  featureId!: string;

  @IsBoolean()
  deseada!: boolean;

  @IsOptional()
  @IsBoolean()
  revocarEnMeta?: boolean;
}
