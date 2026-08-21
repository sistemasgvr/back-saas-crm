import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';

/** Plantillas APROBADAS del WABA — para el picker al escribir fuera de la
 * ventana de 24h. No hay UI de creación/edición en v1: se gestionan en Meta
 * Business Suite, acá solo se listan (PLAN §6 fuera de alcance explícito). */
@Injectable()
export class ListarPlantillasUseCase {
  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string) {
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
    const plantillas = await this.graph.listarPlantillasWhatsApp(
      wabaId,
      accessToken,
    );
    return plantillas.filter((p) => p.estado === 'APPROVED');
  }
}
