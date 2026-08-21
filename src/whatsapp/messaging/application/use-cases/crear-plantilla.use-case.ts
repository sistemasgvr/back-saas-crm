import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type {
  CrearPlantillaWhatsAppInput,
  MetaGraphClient,
} from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { contarVariablesPlantilla } from '../contar-variables-plantilla';

/** Envía la plantilla a revisión de Meta — queda PENDING hasta que la
 * aprueben (horas a días); recién ahí aparece en el selector de envío
 * (ListarPlantillasUseCase ya filtra por APPROVED). */
@Injectable()
export class CrearPlantillaUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string, input: CrearPlantillaWhatsAppInput) {
    const variablesCuerpo = contarVariablesPlantilla(input.cuerpo);
    if (variablesCuerpo > 0 && input.ejemplosCuerpo?.length !== variablesCuerpo) {
      throw new BadRequestException(
        `El mensaje usa ${variablesCuerpo} variable(s) ({{1}}..{{${variablesCuerpo}}}) — hace falta un ejemplo por cada una`,
      );
    }
    const variablesEncabezado = contarVariablesPlantilla(input.encabezado);
    if (variablesEncabezado > 1) {
      throw new BadRequestException(
        'El encabezado solo admite una variable {{1}} — es un límite de Meta',
      );
    }
    if (variablesEncabezado === 1 && !input.ejemploEncabezado) {
      throw new BadRequestException(
        'El encabezado usa {{1}} — hace falta un ejemplo',
      );
    }

    const [conexion, numeros] = await Promise.all([
      this.conexiones.findActivaPorOrganizacion(organizacionId),
      this.whatsappConexiones.listarPorOrganizacion(organizacionId),
    ]);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }
    const wabaId = numeros[0]?.wabaId;
    if (!wabaId) {
      throw new NotFoundException(
        'No hay un número de WhatsApp vinculado a esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);
    await this.graph.crearPlantillaWhatsApp(wabaId, accessToken, input);
  }
}
