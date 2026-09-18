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
import {
  ESTADOS_LLAMADA,
  RESULTADOS_LLAMADA,
} from '../../domain/estados-llamada';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type { WhatsappLlamadasRepository } from '../ports/whatsapp-llamadas.repository.port';

@Injectable()
export class AcceptLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(
    organizacionId: string,
    callId: string,
    sdp: string,
    usuarioId: string,
  ) {
    let llamada = await this.llamadas.findPorCallId(organizacionId, callId);
    if (!llamada) {
      throw new NotFoundException('Llamada no encontrada');
    }

    if (
      llamada.asignadoUsuarioId &&
      llamada.asignadoUsuarioId !== usuarioId
    ) {
      throw new ConflictException('Otro agente ya tomó esta llamada');
    }

    if (!llamada.asignadoUsuarioId) {
      const reclamada = await this.llamadas.reclamar(
        organizacionId,
        callId,
        usuarioId,
      );
      if (!reclamada) {
        throw new ConflictException('Otro agente ya tomó esta llamada');
      }
      llamada = reclamada;
    }

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
        action: 'accept',
        callId: llamada.callId,
        session: { sdp_type: 'answer', sdp },
      },
    );

    const ahora = new Date();
    return this.llamadas.actualizar(organizacionId, llamada.id, {
      estado: ESTADOS_LLAMADA.ACTIVE,
      resultado: RESULTADOS_LLAMADA.CONTESTADA,
      contestadaEn: ahora,
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
