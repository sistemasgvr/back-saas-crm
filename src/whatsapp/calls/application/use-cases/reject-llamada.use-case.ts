import {
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
import { WS_EMITTER } from '../../../../notifications/application/ports/ws-emitter.port';
import type { WsEmitter } from '../../../../notifications/application/ports/ws-emitter.port';

@Injectable()
export class RejectLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    @Inject(WS_EMITTER) private readonly wsEmitter: WsEmitter,
  ) {}

  async execute(
    organizacionId: string,
    callId: string,
    usuarioId: string,
  ) {
    const llamada = await this.llamadas.findPorCallId(organizacionId, callId);
    if (!llamada) {
      throw new NotFoundException('Llamada no encontrada');
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
        action: 'reject',
        callId: llamada.callId,
      },
    );

    const actualizada = await this.llamadas.actualizar(
      organizacionId,
      llamada.id,
      {
        estado: ESTADOS_LLAMADA.REJECTED,
        resultado: RESULTADOS_LLAMADA.RECHAZADA,
        finEn: new Date(),
        asignadoUsuarioId: llamada.asignadoUsuarioId ?? usuarioId,
      },
    );

    this.wsEmitter.emitirAOrganizacion(organizacionId, 'call:ended', {
      id: llamada.id,
      callId: llamada.callId,
      estado: ESTADOS_LLAMADA.REJECTED,
      resultado: RESULTADOS_LLAMADA.RECHAZADA,
    });

    return actualizada;
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
