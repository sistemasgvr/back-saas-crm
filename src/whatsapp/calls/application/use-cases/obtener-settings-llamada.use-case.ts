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
import { conexionPuedeCalling } from '../../../connections/domain/rol-linea-whatsapp';

@Injectable()
export class ObtenerSettingsLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async execute(organizacionId: string, conexionId?: string) {
    const conexion = await this.resolverConexion(organizacionId, conexionId);
    const accessToken = await this.resolverToken(organizacionId);
    const settings = await this.graph.obtenerSettingsLlamadaWhatsApp(
      conexion.phoneNumberId,
      accessToken,
    );
    return {
      conexionId: conexion.id,
      callingHabilitado: conexion.callingHabilitado,
      callingUltimoError: conexion.callingUltimoError,
      settings,
    };
  }

  private async resolverConexion(organizacionId: string, conexionId?: string) {
    if (conexionId) {
      const c = await this.conexionesWa.findPorId(organizacionId, conexionId);
      if (!c) throw new NotFoundException('Conexión no encontrada');
      return c;
    }
    const lista = await this.conexionesWa.listarPorOrganizacion(organizacionId);
    const calling =
      lista.find((c) =>
        conexionPuedeCalling({
          rolLinea: c.rolLinea,
          callingHabilitado: c.callingHabilitado ? 1 : 0,
        }),
      ) ?? lista[0];
    if (!calling) {
      throw new NotFoundException('No hay número WhatsApp vinculado');
    }
    return calling;
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
