import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
} from 'class-validator';
import {
  SECCIONES_EXPORT,
  type SeccionExport,
} from '../application/tablas-export';

export class ExportarDatosQueryDto {
  /** Lista separada por comas: ?secciones=leads,chats */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(SECCIONES_EXPORT, { each: true })
  secciones!: SeccionExport[];

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) =>
      value === 'true' || value === '1' || value === true,
  )
  @IsBoolean()
  medios?: boolean;
}
