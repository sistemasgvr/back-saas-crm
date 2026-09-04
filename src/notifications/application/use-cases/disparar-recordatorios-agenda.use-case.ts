import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { EnviarRecordatorioAgendaWhatsAppUseCase } from '../../../whatsapp/messaging/application/use-cases/enviar-recordatorio-agenda-whatsapp.use-case';
import { CrearNotificacionUseCase } from './crear-notificacion.use-case';
import { ETIQUETAS_TIPO_ACTIVIDAD } from '../../../shared/domain/agenda-actividades';

/** Minutos antes de la cita en los que se dispara un aviso. */
export const OFFSETS_RECORDATORIO_AGENDA_MIN = [30, 15, 5] as const;

const LOOKBACK_MS = 90_000; // tolerancia si el cron se atrasa un tick

type CandidatoAgenda = {
  origen: 'VISITA' | 'ACTIVIDAD';
  itemId: string;
  organizacionId: string;
  leadId: string;
  titulo: string;
  programadaEn: Date;
  asignadoUsuarioId: string | null;
  creadoPorUsuarioId: string | null;
  leadNombre: string | null;
};

/**
 * Busca visitas/actividades PROGRAMADAS cuya hora de aviso (programadaEn − offset)
 * acaba de pasar, crea notificaciones AGENDA_PROXIMA, intenta WhatsApp al lead
 * y marca idempotencia (fila + whatsappEnviado).
 */
@Injectable()
export class DispararRecordatoriosAgendaUseCase {
  private readonly logger = new Logger(DispararRecordatoriosAgendaUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crearNotificacion: CrearNotificacionUseCase,
    private readonly enviarWhatsApp: EnviarRecordatorioAgendaWhatsAppUseCase,
  ) {}

  async execute(ahora = new Date()): Promise<number> {
    let enviados = 0;

    for (const offset of OFFSETS_RECORDATORIO_AGENDA_MIN) {
      const ventanaFin = new Date(ahora.getTime() + offset * 60_000);
      const ventanaInicio = new Date(ventanaFin.getTime() - LOOKBACK_MS);

      const candidatos = await this.buscarCandidatos(ventanaInicio, ventanaFin);
      for (const c of candidatos) {
        const ok = await this.intentarEnviar(c, offset);
        if (ok) enviados += 1;
      }
    }

    if (enviados > 0) {
      this.logger.log(`Recordatorios de agenda enviados: ${enviados}`);
    }
    return enviados;
  }

  private async buscarCandidatos(
    desde: Date,
    hasta: Date,
  ): Promise<CandidatoAgenda[]> {
    const [visitas, actividades] = await Promise.all([
      this.prisma.leadVisita.findMany({
        where: {
          estado: 'PROGRAMADA',
          programadaEn: { gte: desde, lt: hasta },
        },
        select: {
          id: true,
          organizacionId: true,
          leadId: true,
          programadaEn: true,
          asignadoUsuarioId: true,
          creadoPorUsuarioId: true,
          referenciaInmueble: true,
          lead: { select: { nombre: true } },
        },
      }),
      this.prisma.leadActividad.findMany({
        where: {
          estado: 'PROGRAMADA',
          programadaEn: { gte: desde, lt: hasta },
        },
        select: {
          id: true,
          organizacionId: true,
          leadId: true,
          titulo: true,
          tipo: true,
          programadaEn: true,
          asignadoUsuarioId: true,
          creadoPorUsuarioId: true,
          lead: { select: { nombre: true } },
        },
      }),
    ]);

    const out: CandidatoAgenda[] = [];

    for (const v of visitas) {
      out.push({
        origen: 'VISITA',
        itemId: v.id,
        organizacionId: v.organizacionId,
        leadId: v.leadId,
        titulo: v.referenciaInmueble
          ? `Visita — ${v.referenciaInmueble}`
          : 'Visita',
        programadaEn: v.programadaEn,
        asignadoUsuarioId: v.asignadoUsuarioId,
        creadoPorUsuarioId: v.creadoPorUsuarioId,
        leadNombre: v.lead.nombre,
      });
    }

    for (const a of actividades) {
      const etiqueta =
        ETIQUETAS_TIPO_ACTIVIDAD[
          a.tipo as keyof typeof ETIQUETAS_TIPO_ACTIVIDAD
        ] ?? a.tipo;
      out.push({
        origen: 'ACTIVIDAD',
        itemId: a.id,
        organizacionId: a.organizacionId,
        leadId: a.leadId,
        titulo: a.titulo || etiqueta,
        programadaEn: a.programadaEn,
        asignadoUsuarioId: a.asignadoUsuarioId,
        creadoPorUsuarioId: a.creadoPorUsuarioId,
        leadNombre: a.lead.nombre,
      });
    }

    return out;
  }

  private async intentarEnviar(
    c: CandidatoAgenda,
    offsetMinutos: number,
  ): Promise<boolean> {
    const destinatario = c.asignadoUsuarioId ?? c.creadoPorUsuarioId;
    if (!destinatario) return false;

    let esNuevo = false;
    try {
      await this.prisma.agendaRecordatorioEnviado.create({
        data: {
          origen: c.origen,
          itemId: c.itemId,
          offsetMinutos,
        },
      });
      esNuevo = true;
    } catch {
      // Unique violation → notificación in-app ya disparada; puede faltar WA
    }

    const cuando = c.programadaEn.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const lead = c.leadNombre?.trim() || 'Lead';
    const titulo =
      offsetMinutos <= 5
        ? `En ${offsetMinutos} min: ${c.titulo}`
        : `En ${offsetMinutos} min — ${c.titulo}`;
    const mensaje = `${lead} · ${cuando}`;

    if (esNuevo) {
      const resultado = await this.crearNotificacion.execute({
        organizacionId: c.organizacionId,
        tipo: 'AGENDA_PROXIMA',
        titulo: titulo.slice(0, 200),
        mensaje: mensaje.slice(0, 500),
        payload: {
          leadId: c.leadId,
          origen: c.origen,
          ...(c.origen === 'VISITA'
            ? { visitaId: c.itemId }
            : { actividadId: c.itemId }),
          programadaEn: c.programadaEn.toISOString(),
          offsetMinutos,
        },
        usuarioIds: [destinatario],
      });

      if (resultado?.id) {
        await this.prisma.agendaRecordatorioEnviado
          .update({
            where: {
              origen_itemId_offsetMinutos: {
                origen: c.origen,
                itemId: c.itemId,
                offsetMinutos,
              },
            },
            data: { notificacionId: resultado.id },
          })
          .catch(() => undefined);
      }
    }

    await this.intentarWhatsApp(c, offsetMinutos, cuando);

    return esNuevo;
  }

  /**
   * Claim atómico con `whatsappEnviado`: solo un worker envía.
   * Se marca antes del Graph call para no duplicar si el cron se solapa.
   */
  private async intentarWhatsApp(
    c: CandidatoAgenda,
    offsetMinutos: number,
    cuando: string,
  ): Promise<void> {
    const claimed = await this.prisma.agendaRecordatorioEnviado.updateMany({
      where: {
        origen: c.origen,
        itemId: c.itemId,
        offsetMinutos,
        whatsappEnviado: 0,
      },
      data: { whatsappEnviado: 1 },
    });
    if (claimed.count === 0) return;

    const texto =
      `Recordatorio: en ${offsetMinutos} min — ${c.titulo} (${cuando})`.slice(
        0,
        1000,
      );

    const resultado = await this.enviarWhatsApp.execute({
      organizacionId: c.organizacionId,
      leadId: c.leadId,
      texto,
    });

    if (resultado.ok) {
      this.logger.log(
        `WhatsApp agenda (${resultado.via}) → lead ${c.leadId} conversación ${resultado.conversacionId}`,
      );
      return;
    }

    // Claim ya consumido: no reintentar en el siguiente tick (evita spam de logs).
    this.logger.debug(
      `WhatsApp agenda omitido lead ${c.leadId}: ${resultado.motivo}`,
    );
  }
}
