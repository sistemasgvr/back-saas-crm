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
import {
  DIRECCIONES_LLAMADA,
  ESTADOS_LLAMADA,
} from '../../domain/estados-llamada';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type { WhatsappLlamadasRepository } from '../ports/whatsapp-llamadas.repository.port';
import { idParaEnvioWhatsApp } from '../../../messaging/domain/identidad-contacto-whatsapp';

export interface IniciarLlamadaSalienteInput {
  conversacionId?: string;
  waId?: string;
  sdp: string;
}

@Injectable()
export class IniciarLlamadaSalienteUseCase {
  constructor(
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexionesMeta: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    organizacionId: string,
    input: IniciarLlamadaSalienteInput,
    usuarioId: string,
  ) {
    if (!input.sdp?.trim()) {
      throw new BadRequestException('Falta el SDP offer');
    }
    if (!input.conversacionId && !input.waId) {
      throw new BadRequestException(
        'Indique conversacionId o waId del destinatario',
      );
    }

    const conexionCalling = await this.resolverConexionCalling(organizacionId);
    const accessToken = await this.resolverToken(organizacionId);

    let waId: string | null = null;
    let conversacionId: string | null = null;
    let leadId: string | null = null;

    if (input.conversacionId) {
      const conv = await this.prisma.whatsappConversacion.findFirst({
        where: {
          id: input.conversacionId,
          organizacionId,
          estado: 1,
        },
      });
      if (!conv) {
        throw new NotFoundException('Conversación no encontrada');
      }
      conversacionId = conv.id;
      leadId = conv.leadId;
      waId =
        idParaEnvioWhatsApp({
          waId: conv.waId,
          bsuid: conv.bsuid,
        }) ?? null;
    } else if (input.waId) {
      waId = input.waId.replace(/\D/g, '') || input.waId;
      const conv = await this.prisma.whatsappConversacion.findFirst({
        where: { organizacionId, waId, estado: 1 },
        orderBy: { ultimoMensajeEn: 'desc' },
      });
      conversacionId = conv?.id ?? null;
      leadId = conv?.leadId ?? null;
    }

    if (!waId) {
      throw new BadRequestException(
        'No se pudo resolver el destinatario de la llamada',
      );
    }

    const permiso = await this.graph.obtenerPermisosLlamadaWhatsApp(
      conexionCalling.phoneNumberId,
      accessToken,
      waId,
    );
    const status = permiso.permission?.status?.toUpperCase();
    if (status && status !== 'GRANTED' && status !== 'TEMPORARY') {
      throw new BadRequestException(
        `Sin permiso de llamada (status=${permiso.permission?.status ?? 'desconocido'})`,
      );
    }

    const resultado = await this.graph.accionLlamadaWhatsApp(
      conexionCalling.phoneNumberId,
      accessToken,
      {
        action: 'connect',
        to: waId,
        session: { sdp_type: 'offer', sdp: input.sdp },
      },
    );

    const callId = resultado.calls?.[0]?.id;
    if (!callId) {
      throw new BadRequestException(
        'Meta no devolvió call_id al iniciar la llamada saliente',
      );
    }

    return this.llamadas.upsertPorCallId({
      organizacionId,
      whatsappConexionId: conexionCalling.id,
      callId,
      waId,
      conversacionId,
      leadId,
      asignadoUsuarioId: usuarioId,
      direccion: DIRECCIONES_LLAMADA.SALIENTE,
      estado: ESTADOS_LLAMADA.RINGING,
      inicioEn: new Date(),
      datosCrudos: resultado,
    });
  }

  private async resolverConexionCalling(
    organizacionId: string,
  ): Promise<WhatsappConexionRow> {
    const conexiones =
      await this.conexionesWa.listarPorOrganizacion(organizacionId);
    const calling = conexiones.find((c) =>
      conexionPuedeCalling({
        rolLinea: c.rolLinea,
        callingHabilitado: c.callingHabilitado ? 1 : 0,
      }),
    );
    if (!calling) {
      throw new NotFoundException(
        'No hay una línea WhatsApp con Calling habilitado (rol LLAMADAS|AMBOS)',
      );
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
