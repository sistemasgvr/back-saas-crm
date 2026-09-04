import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_CONEXIONES_REPOSITORY } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import type { MetaConexionesRepository } from '../../../../meta/connections/application/ports/meta-conexiones.repository.port';
import { META_GRAPH_CLIENT } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import type { MetaGraphClient } from '../../../../meta/connections/application/ports/meta-graph-client.port';
import { TokenEncryptionService } from '../../../../shared/infrastructure/token-encryption.service';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';

export interface EnviarRecordatorioAgendaWhatsAppInput {
  organizacionId: string;
  leadId: string;
  /** Texto de sesión (dentro de ventana 24h). */
  texto: string;
}

export type ResultadoRecordatorioAgendaWhatsApp =
  | { ok: true; conversacionId: string; via: 'texto' | 'plantilla' }
  | { ok: false; motivo: string };

/**
 * Envío de sistema (cron) al lead vinculado — reutiliza Graph + token como
 * EnviarMensajeWhatsAppUseCase, sin chequeo de rol de usuario.
 */
@Injectable()
export class EnviarRecordatorioAgendaWhatsAppUseCase {
  private readonly logger = new Logger(
    EnviarRecordatorioAgendaWhatsAppUseCase.name,
  );

  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly conexionesWa: WhatsappConexionesRepository,
    @Inject(META_CONEXIONES_REPOSITORY)
    private readonly conexiones: MetaConexionesRepository,
    @Inject(META_GRAPH_CLIENT) private readonly graph: MetaGraphClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    input: EnviarRecordatorioAgendaWhatsAppInput,
  ): Promise<ResultadoRecordatorioAgendaWhatsApp> {
    const conversacion = await this.conversaciones.findActivaPorLeadId(
      input.organizacionId,
      input.leadId,
    );
    if (!conversacion) {
      this.logger.debug(
        `Lead ${input.leadId}: sin conversación WhatsApp activa — se omite recordatorio`,
      );
      return { ok: false, motivo: 'sin_conversacion' };
    }
    if (conversacion.bloqueado) {
      this.logger.warn(
        `Lead ${input.leadId}: conversación ${conversacion.id} bloqueada — se omite`,
      );
      return { ok: false, motivo: 'bloqueado' };
    }

    const whatsappConexion = await this.conexionesWa.listarPorOrganizacion(
      input.organizacionId,
    );
    const conexionActiva = whatsappConexion[0];
    if (!conexionActiva) {
      this.logger.warn(
        `Org ${input.organizacionId}: sin número WhatsApp vinculado — se omite`,
      );
      return { ok: false, motivo: 'sin_conexion_wa' };
    }

    const conexion = await this.conexiones.findActivaPorOrganizacion(
      input.organizacionId,
    );
    if (!conexion?.tokenCifrado) {
      this.logger.warn(
        `Org ${input.organizacionId}: sin sesión Meta activa — se omite`,
      );
      return { ok: false, motivo: 'sin_sesion_meta' };
    }
    const accessToken = this.tokenEncryption.decrypt(conexion.tokenCifrado);

    const dentroDeVentana =
      conversacion.ventanaExpiraEn !== null &&
      conversacion.ventanaExpiraEn.getTime() > Date.now();

    try {
      if (dentroDeVentana) {
        const resultado = await this.graph.enviarMensajeTextoWhatsApp(
          conexionActiva.phoneNumberId,
          accessToken,
          conversacion.waId,
          input.texto,
        );
        await this.conversaciones.registrarMensaje({
          organizacionId: input.organizacionId,
          whatsappConversacionId: conversacion.id,
          wamid: resultado.wamid,
          direccion: 'saliente',
          tipo: 'text',
          texto: input.texto,
          estadoEntrega: 'enviado',
          datosCrudos: {
            tipo: 'text',
            texto: input.texto,
            origen: 'agenda_recordatorio',
          },
          fechaMensaje: new Date(),
        });
        return {
          ok: true,
          conversacionId: conversacion.id,
          via: 'texto',
        };
      }

      const plantilla = this.config
        .get<string>('WHATSAPP_AGENDA_REMINDER_TEMPLATE')
        ?.trim();
      if (!plantilla) {
        this.logger.warn(
          `Lead ${input.leadId}: fuera de ventana 24h y WHATSAPP_AGENDA_REMINDER_TEMPLATE no está definida — se omite`,
        );
        return { ok: false, motivo: 'sin_plantilla' };
      }
      const idioma =
        this.config
          .get<string>('WHATSAPP_AGENDA_REMINDER_TEMPLATE_LANG')
          ?.trim() || 'es';

      const resultado = await this.graph.enviarMensajePlantillaWhatsApp(
        conexionActiva.phoneNumberId,
        accessToken,
        conversacion.waId,
        plantilla,
        idioma,
      );
      await this.conversaciones.registrarMensaje({
        organizacionId: input.organizacionId,
        whatsappConversacionId: conversacion.id,
        wamid: resultado.wamid,
        direccion: 'saliente',
        tipo: 'template',
        plantillaNombre: plantilla,
        estadoEntrega: 'enviado',
        datosCrudos: {
          tipo: 'template',
          plantilla,
          idioma,
          origen: 'agenda_recordatorio',
        },
        fechaMensaje: new Date(),
      });
      return {
        ok: true,
        conversacionId: conversacion.id,
        via: 'plantilla',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Lead ${input.leadId}: fallo enviando recordatorio WhatsApp — ${msg}`,
      );
      return { ok: false, motivo: 'error_envio' };
    }
  }
}
