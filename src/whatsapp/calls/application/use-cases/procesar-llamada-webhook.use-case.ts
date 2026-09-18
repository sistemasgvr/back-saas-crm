import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { ROL_LINEA_WHATSAPP } from '../../../connections/domain/rol-linea-whatsapp';
import { WS_EMITTER } from '../../../../notifications/application/ports/ws-emitter.port';
import type { WsEmitter } from '../../../../notifications/application/ports/ws-emitter.port';
import {
  DIRECCIONES_LLAMADA,
  ESTADOS_LLAMADA,
  RESULTADOS_LLAMADA,
} from '../../domain/estados-llamada';
import { WHATSAPP_LLAMADAS_REPOSITORY } from '../ports/whatsapp-llamadas.repository.port';
import type { WhatsappLlamadasRepository } from '../ports/whatsapp-llamadas.repository.port';
import { LlamadaPresenciaService } from '../../infrastructure/llamada-presencia.service';
import type { EventoLlamadaWhatsApp } from '../../../../meta/webhooks/domain/whatsapp-webhook-payload.interface';

const AUTO_REJECT_MS = 45_000;

@Injectable()
export class ProcesarLlamadaWebhookUseCase {
  private readonly logger = new Logger(ProcesarLlamadaWebhookUseCase.name);
  /** Timers de auto-reject por callId de Meta. */
  private readonly autoRejectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(WHATSAPP_LLAMADAS_REPOSITORY)
    private readonly llamadas: WhatsappLlamadasRepository,
    private readonly presencia: LlamadaPresenciaService,
    private readonly prisma: PrismaService,
    @Inject(WS_EMITTER) private readonly wsEmitter: WsEmitter,
  ) {}

  async execute(evento: EventoLlamadaWhatsApp): Promise<void> {
    const conexion = await this.conexionesWa.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) {
      this.logger.warn(
        `Llamada webhook ignorada: phone_number_id ${evento.phoneNumberId} sin conexión`,
      );
      return;
    }

    const waId = evento.waId
      ? evento.waId.replace(/\D/g, '') || evento.waId
      : null;
    const { conversacionId, leadId, asignadoLeadId } =
      await this.resolverConversacionYLead(
        conexion.organizacionId,
        waId,
      );

    const esEntrante =
      evento.direction === 'USER_INITIATED' ||
      (!evento.direction && evento.event === 'connect');
    const direccion = esEntrante
      ? DIRECCIONES_LLAMADA.ENTRANTE
      : DIRECCIONES_LLAMADA.SALIENTE;

    const eventLower = (evento.event ?? '').toLowerCase();

    if (eventLower === 'connect' || eventLower === 'ringing') {
      await this.manejarConnect({
        conexion,
        evento,
        waId,
        conversacionId,
        leadId,
        asignadoLeadId,
        direccion,
      });
      return;
    }

    if (
      eventLower === 'terminate' ||
      eventLower === 'ended' ||
      eventLower === 'completed'
    ) {
      await this.manejarTerminate(conexion.organizacionId, evento);
      return;
    }

    // Actualización genérica de estado/resultado
    const estado =
      eventLower === 'reject' || eventLower === 'rejected'
        ? ESTADOS_LLAMADA.REJECTED
        : eventLower === 'missed'
          ? ESTADOS_LLAMADA.MISSED
          : eventLower === 'failed'
            ? ESTADOS_LLAMADA.FAILED
            : ESTADOS_LLAMADA.RINGING;

    const resultado =
      estado === ESTADOS_LLAMADA.REJECTED
        ? RESULTADOS_LLAMADA.RECHAZADA
        : estado === ESTADOS_LLAMADA.MISSED
          ? RESULTADOS_LLAMADA.NO_CONTESTADA
          : estado === ESTADOS_LLAMADA.FAILED
            ? RESULTADOS_LLAMADA.FALLIDA
            : null;

    await this.llamadas.upsertPorCallId({
      organizacionId: conexion.organizacionId,
      whatsappConexionId: conexion.id,
      callId: evento.callId,
      waId,
      conversacionId,
      leadId,
      direccion,
      estado,
      resultado,
      inicioEn: evento.timestamp,
      datosCrudos: evento.raw,
    });
  }

  private async manejarConnect(params: {
    conexion: { id: string; organizacionId: string };
    evento: EventoLlamadaWhatsApp;
    waId: string | null;
    conversacionId: string | null;
    leadId: string | null;
    asignadoLeadId: string | null;
    direccion: string;
  }): Promise<void> {
    const {
      conexion,
      evento,
      waId,
      conversacionId,
      leadId,
      asignadoLeadId,
      direccion,
    } = params;

    const llamada = await this.llamadas.upsertPorCallId({
      organizacionId: conexion.organizacionId,
      whatsappConexionId: conexion.id,
      callId: evento.callId,
      waId,
      conversacionId,
      leadId,
      direccion,
      estado: ESTADOS_LLAMADA.RINGING,
      inicioEn: evento.timestamp,
      datosCrudos: evento.raw,
    });

    if (direccion !== DIRECCIONES_LLAMADA.ENTRANTE) {
      return;
    }

    const disponibles = this.presencia.listDisponibles(conexion.organizacionId);
    if (disponibles.length === 0) {
      this.logger.log(
        `Llamada ${evento.callId}: ningún agente disponible → MISSED`,
      );
      await this.llamadas.actualizar(conexion.organizacionId, llamada.id, {
        estado: ESTADOS_LLAMADA.MISSED,
        resultado: RESULTADOS_LLAMADA.NO_CONTESTADA,
        finEn: new Date(),
      });
      this.cancelarAutoReject(evento.callId);
      return;
    }

    // Preferir al asesor del lead si está disponible
    let destinatarios = disponibles;
    if (asignadoLeadId && disponibles.includes(asignadoLeadId)) {
      destinatarios = [asignadoLeadId];
    }

    this.wsEmitter.emitirAUsuarios(destinatarios, 'call:incoming', {
      id: llamada.id,
      callId: llamada.callId,
      waId: llamada.waId,
      conversacionId: llamada.conversacionId,
      leadId: llamada.leadId,
      sdpOffer: evento.session?.sdp ?? null,
      sdpType: evento.session?.sdp_type ?? 'offer',
      inicioEn: llamada.inicioEn,
    });

    this.programarAutoReject(conexion.organizacionId, evento.callId, llamada.id);
  }

  private async manejarTerminate(
    organizacionId: string,
    evento: EventoLlamadaWhatsApp,
  ): Promise<void> {
    this.cancelarAutoReject(evento.callId);

    const existente = await this.llamadas.findPorCallId(
      organizacionId,
      evento.callId,
    );
    const finEn = evento.timestamp;
    let resultado: string = RESULTADOS_LLAMADA.CONTESTADA;
    let estado: string = ESTADOS_LLAMADA.ENDED;
    let duracionSeg: number | null = null;

    if (existente) {
      if (
        existente.estado === ESTADOS_LLAMADA.RINGING ||
        existente.estado === ESTADOS_LLAMADA.PRE_ACCEPTED
      ) {
        estado = ESTADOS_LLAMADA.MISSED;
        resultado = RESULTADOS_LLAMADA.NO_CONTESTADA;
      } else if (existente.contestadaEn) {
        duracionSeg = Math.max(
          0,
          Math.round((finEn.getTime() - existente.contestadaEn.getTime()) / 1000),
        );
      }

      const actualizada = await this.llamadas.actualizar(
        organizacionId,
        existente.id,
        {
          estado,
          resultado,
          finEn,
          duracionSeg,
          datosCrudos: evento.raw,
        },
      );

      this.wsEmitter.emitirAOrganizacion(organizacionId, 'call:ended', {
        id: actualizada?.id ?? existente.id,
        callId: evento.callId,
        estado,
        resultado,
        duracionSeg,
      });
      return;
    }

    // Terminate sin connect previo — no debería pasar, pero upsert defensivo
    const conexion = await this.conexionesWa.findPorPhoneNumberId(
      evento.phoneNumberId,
    );
    if (!conexion) return;

    await this.llamadas.upsertPorCallId({
      organizacionId,
      whatsappConexionId: conexion.id,
      callId: evento.callId,
      waId: evento.waId,
      direccion:
        evento.direction === 'BUSINESS_INITIATED'
          ? DIRECCIONES_LLAMADA.SALIENTE
          : DIRECCIONES_LLAMADA.ENTRANTE,
      estado: ESTADOS_LLAMADA.ENDED,
      resultado,
      inicioEn: evento.timestamp,
      finEn,
      datosCrudos: evento.raw,
    });
  }

  private programarAutoReject(
    organizacionId: string,
    callId: string,
    llamadaId: string,
  ): void {
    this.cancelarAutoReject(callId);
    const timer = setTimeout(() => {
      void this.ejecutarAutoReject(organizacionId, callId, llamadaId);
    }, AUTO_REJECT_MS);
    this.autoRejectTimers.set(callId, timer);
  }

  private cancelarAutoReject(callId: string): void {
    const timer = this.autoRejectTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.autoRejectTimers.delete(callId);
    }
  }

  private async ejecutarAutoReject(
    organizacionId: string,
    callId: string,
    llamadaId: string,
  ): Promise<void> {
    this.autoRejectTimers.delete(callId);
    try {
      const actual = await this.llamadas.findPorId(organizacionId, llamadaId);
      if (!actual || actual.estado !== ESTADOS_LLAMADA.RINGING) return;
      if (actual.asignadoUsuarioId) return;

      await this.llamadas.actualizar(organizacionId, llamadaId, {
        estado: ESTADOS_LLAMADA.MISSED,
        resultado: RESULTADOS_LLAMADA.NO_CONTESTADA,
        finEn: new Date(),
      });
      this.wsEmitter.emitirAOrganizacion(organizacionId, 'call:ended', {
        id: llamadaId,
        callId,
        estado: ESTADOS_LLAMADA.MISSED,
        resultado: RESULTADOS_LLAMADA.NO_CONTESTADA,
      });
      this.logger.log(`Auto-reject (timeout) llamada ${callId}`);
    } catch (error) {
      this.logger.error(
        `Error en auto-reject de llamada ${callId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async resolverConversacionYLead(
    organizacionId: string,
    waId: string | null,
  ): Promise<{
    conversacionId: string | null;
    leadId: string | null;
    asignadoLeadId: string | null;
  }> {
    if (!waId) {
      return { conversacionId: null, leadId: null, asignadoLeadId: null };
    }

    // Preferir conversación de línea de mensajería (MENSAJES | AMBOS)
    const conversaciones = await this.prisma.whatsappConversacion.findMany({
      where: {
        organizacionId,
        estado: 1,
        waId,
      },
      include: {
        whatsappConexion: {
          select: { rolLinea: true },
        },
        lead: { select: { id: true, asignadoUsuarioId: true } },
      },
      orderBy: { ultimoMensajeEn: 'desc' },
    });

    const preferida =
      conversaciones.find(
        (c) =>
          c.whatsappConexion.rolLinea === ROL_LINEA_WHATSAPP.MENSAJES ||
          c.whatsappConexion.rolLinea === ROL_LINEA_WHATSAPP.AMBOS,
      ) ?? conversaciones[0];

    if (!preferida) {
      return { conversacionId: null, leadId: null, asignadoLeadId: null };
    }

    return {
      conversacionId: preferida.id,
      leadId: preferida.leadId,
      asignadoLeadId: preferida.lead?.asignadoUsuarioId ?? null,
    };
  }
}
