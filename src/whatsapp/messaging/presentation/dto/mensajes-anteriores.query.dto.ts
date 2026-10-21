import { IsUUID } from 'class-validator';

export class MensajesAnterioresQueryDto {
  @IsUUID() before: string;
}
