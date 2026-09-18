import {
  ConflictException,
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
import { ESTADOS_LLAMADA } from '../../domain/estados-llamada';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type { WhatsappLlamadasRepository } from '../ports/whatsapp-llamadas.repository.port';
import { LlamadaPresenciaService } from '../../infrastructure/llamada-presencia.service';

@Injectable()
export class PreAcceptLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly presencia: LlamadaPresenciaService,
  ) {}

  async execute(
    organizacionId: string,
    callId: string,
    sdp: string,
    usuarioId: string,
  ) {
    const reclamada = await this.llamadas.reclamar(
      organizacionId,
      callId,
      usuarioId,
    );
    if (!reclamada) {
      const existente = await this.llamadas.findPorCallId(
        organizacionId,
        callId,
      );
      if (!existente) {
        throw new NotFoundException('Llamada no encontrada');
      }
      if (existente.asignadoUsuarioId === usuarioId) {
        // Ya reclamada por el mismo usuario — reintentar pre_accept
      } else {
        throw new ConflictException(
          'Otro agente ya tomó esta llamada',
        );
      }
    }

    const llamada =
      reclamada ??
      (await this.llamadas.findPorCallId(organizacionId, callId))!;

    const conexionWa = await this.conexionesWa.findPorId(
      organizacionId,
      llamada.whatsappConexionId,
    );
    if (!conexionWa) {
      throw new NotFoundException('Conexión WhatsApp no encontrada');
    }

    const accessToken = await this.resolverToken(organizacionId);
    await this.graph.accionLlamadaWhatsApp(
      conexionWa.phoneNumberId,
      accessToken,
      {
        action: 'pre_accept',
        callId: llamada.callId,
        session: { sdp_type: 'answer', sdp },
      },
    );

    this.presencia.setDisponible(organizacionId, usuarioId, true);

    return this.llamadas.actualizar(organizacionId, llamada.id, {
      estado: ESTADOS_LLAMADA.PRE_ACCEPTED,
      asignadoUsuarioId: usuarioId,
    });
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
