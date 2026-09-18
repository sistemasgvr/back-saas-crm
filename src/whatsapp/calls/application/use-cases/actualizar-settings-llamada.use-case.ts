import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';

export interface ActualizarSettingsLlamadaInput {
  conexionId: string;
  status?: string;
  callIconVisibility?: string;
  callHours?: unknown;
  callbackPermissionStatus?: string;
}

@Injectable()
export class ActualizarSettingsLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    input: ActualizarSettingsLlamadaInput,
  ) {
    if (!input.conexionId) {
      throw new BadRequestException('conexionId es obligatorio');
    }

    const conexion = await this.conexionesWa.findPorId(
      organizacionId,
      input.conexionId,
    );
    if (!conexion) {
      throw new NotFoundException('Conexión no encontrada');
    }

    const body: Record<string, unknown> = {};
    if (input.status !== undefined) body.status = input.status;
    if (input.callIconVisibility !== undefined) {
      body.call_icon_visibility = input.callIconVisibility;
    }
    if (input.callHours !== undefined) body.call_hours = input.callHours;
    if (input.callbackPermissionStatus !== undefined) {
      body.callback_permission_status = input.callbackPermissionStatus;
    }

    const accessToken = await this.resolverToken(organizacionId);
    try {
      await this.graph.actualizarSettingsLlamadaWhatsApp(
        conexion.phoneNumberId,
        accessToken,
        body,
      );

      if (input.status !== undefined) {
        const habilitado = input.status.toUpperCase() === 'ENABLED';
        await this.conexionesWa.actualizarCallingHabilitado(
          conexion.id,
          habilitado,
          null,
        );
      }

      return { ok: true };
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Error actualizando settings';
      await this.conexionesWa.actualizarCallingHabilitado(
        conexion.id,
        conexion.callingHabilitado,
        mensaje,
      );
      throw error;
    }
  }

  private async resolverToken(organizacionId: string): Promise<string> {
    const conexion =
      await this.conexionesMeta.findActivaPorOrganizacion(organizacionId);
    if (!conexion?.tokenCifrado) {
      throw new NotFoundException(
        'No hay una sesión de Meta conectada para esta organización',
      );
    }
    return this.tokenEncryption.decrypt(conexion.tokenCifrado);
  }
}
