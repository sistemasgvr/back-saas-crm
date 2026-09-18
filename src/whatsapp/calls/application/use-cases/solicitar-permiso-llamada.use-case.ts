import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma.service';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type {
  WhatsappConexionRow,
  WhatsappConexionesRepository,
} from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { conexionPuedeCalling } from '../../../connections/domain/rol-linea-whatsapp';
import { idParaEnvioWhatsApp } from '../../../messaging/domain/identidad-contacto-whatsapp';

export interface SolicitarPermisoInput {
  conversacionId?: string;
  waId?: string;
  mensaje?: string;
  plantillaNombre?: string;
  plantillaIdioma?: string;
}

@Injectable()
export class SolicitarPermisoLlamadaUseCase {
  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(organizacionId: string, input: SolicitarPermisoInput) {
    const { waId, conexion } = await this.resolverDestino(
      organizacionId,
      input,
    );
    const accessToken = await this.resolverToken(organizacionId);

    return this.graph.solicitarPermisoLlamadaWhatsApp(
      conexion.phoneNumberId,
      accessToken,
      {
        to: waId,
        mensaje: input.mensaje,
        plantillaNombre: input.plantillaNombre,
        plantillaIdioma: input.plantillaIdioma,
      },
    );
  }

  private async resolverDestino(
    organizacionId: string,
    input: SolicitarPermisoInput,
  ): Promise<{ waId: string; conexion: WhatsappConexionRow }> {
    if (!input.conversacionId && !input.waId) {
      throw new BadRequestException('Indique conversacionId o waId');
    }

    const conexion = await this.resolverConexionCalling(organizacionId);
    let waId: string | null = null;

    if (input.conversacionId) {
      const conv = await this.prisma.whatsappConversacion.findFirst({
        where: { id: input.conversacionId, organizacionId, estado: 1 },
      });
      if (!conv) throw new NotFoundException('Conversación no encontrada');
      waId = idParaEnvioWhatsApp({ waId: conv.waId, bsuid: conv.bsuid });
    } else if (input.waId) {
      waId = input.waId.replace(/\D/g, '') || input.waId;
    }

    if (!waId) {
      throw new BadRequestException('No se pudo resolver el destinatario');
    }
    return { waId, conexion };
  }

  private async resolverConexionCalling(
    organizacionId: string,
  ): Promise<WhatsappConexionRow> {
    const conexiones =
      await this.conexionesWa.listarPorOrganizacion(organizacionId);
    const calling =
      conexiones.find((c) =>
        conexionPuedeCalling({
          rolLinea: c.rolLinea,
          callingHabilitado: c.callingHabilitado ? 1 : 0,
        }),
      ) ?? conexiones.find((c) => c.rolLinea !== 'MENSAJES') ?? conexiones[0];
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
