import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../ports/whatsapp-conexiones.repository.port';

@Injectable()
export class VincularNumeroUseCase {
  private readonly logger = new Logger(VincularNumeroUseCase.name);

  constructor(
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    wabaId: string,
    phoneNumberId: string,
    numeroDisplay: string | undefined,
    nombreVerificado: string | undefined,
    usuarioEdicion: string,
  ) {
    const conexion =
      await this.conexiones.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }

    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);

    const numero = await this.whatsappConexiones.vincular({
      organizacionId,
      metaConexionId: conexion.id,
      wabaId,
      phoneNumberId,
      numeroDisplay,
      nombreVerificado,
      usuarioEdicion,
    });

    try {
      await this.graph.suscribirWabaWebhook(wabaId, accessToken);
      await this.whatsappConexiones.marcarWebhookSuscrito(
        numero.id,
        usuarioEdicion,
      );
    } catch (error) {
      // No revertimos la vinculación — igual que Páginas (Fase 13), queda
      // vinculado sin webhook y se puede reintentar (PLAN §9 checklist Meta).
      this.logger.warn(
        `No se pudo suscribir el WABA ${wabaId} al webhook — se vinculó sin suscripción`,
        error instanceof Error ? error.stack : error,
      );
    }

    return this.whatsappConexiones.findPorId(organizacionId, numero.id);
  }
}
