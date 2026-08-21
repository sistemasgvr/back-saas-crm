import { IsIn } from 'class-validator';
import { TIPOS_LEAD_INMOBILIARIA } from '../../../shared/domain/tipos-lead-inmobiliaria';

export class ActualizarTipoLeadDto {
  @IsIn(TIPOS_LEAD_INMOBILIARIA)
  tipoLead: string;
}
