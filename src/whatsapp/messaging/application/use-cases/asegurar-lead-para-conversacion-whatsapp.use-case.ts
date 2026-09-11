import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LEADS_GESTION_REPOSITORY } from '../../../../leads/application/ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../../../../leads/application/ports/leads-gestion.repository.port';
import { AutoAsignarLeadUseCase } from '../../../../leads/application/use-cases/auto-asignar-lead.use-case';
import { CrearNotificacionUseCase } from '../../../../notifications/application/use-cases/crear-notificacion.use-case';
import { etiquetaContactoWhatsApp } from '../../domain/identidad-contacto-whatsapp';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';

export interface ResultadoAsegurarLeadWhatsApp {
  leadId: string | null;
  creado: boolean;
  fueAutoAsignado: boolean;
  asignadoUsuarioId: string | null;
}

/**
 * Garantiza que una conversación WA tenga lead vinculado:
 * match por teléfono (si hay) → crear lead sin asignar → vincular → AutoAsignar (si pool ON).
 * Usado solo desde el inbound de mensajes (sin actor humano).
 *
 * Si el chat ya tiene lead pero sigue sin dueño, reintenta auto-asignación
 * (antes se hacía early-return y el lead quedaba libre para siempre).
 */
@Injectable()
export class AsegurarLeadParaConversacionWhatsAppUseCase {
  private readonly logger = new Logger(
    AsegurarLeadParaConversacionWhatsAppUseCase.name,
  );

  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leadsGestion: LeadsGestionRepository,
    private readonly autoAsignarLead: AutoAsignarLeadUseCase,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  async execute(
    organizacionId: string,
    conversacionId: string,
  ): Promise<ResultadoAsegurarLeadWhatsApp> {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      return {
        leadId: null,
        creado: false,
        fueAutoAsignado: false,
        asignadoUsuarioId: null,
      };
    }

    const etiqueta = etiquetaContactoWhatsApp({
      nombre: conversacion.nombreContacto,
      username: conversacion.username,
      waId: conversacion.waId,
      bsuid: conversacion.bsuid,
    });

    if (conversacion.lead?.asignadoUsuarioId) {
      return {
        leadId: conversacion.lead.id,
        creado: false,
        fueAutoAsignado: false,
        asignadoUsuarioId: conversacion.lead.asignadoUsuarioId,
      };
    }

    if (conversacion.lead && !conversacion.lead.asignadoUsuarioId) {
      return this.intentarAutoAsignarExistente(
        organizacionId,
        conversacionId,
        conversacion.lead.id,
        etiqueta,
        false,
      );
    }

    let creado = false;
    let leadId: string | null = null;

    if (conversacion.waId) {
      leadId = await this.leadsGestion.buscarIdPorTelefonoSufijo(
        organizacionId,
        conversacion.waId,
      );
    }

    if (!leadId) {
      const telefono = conversacion.waId
        ? conversacion.waId.startsWith('+')
          ? conversacion.waId
          : `+${conversacion.waId}`
        : null;
      const nombre =
        conversacion.nombreContacto?.trim() ||
        (conversacion.username
          ? conversacion.username.startsWith('@')
            ? conversacion.username
            : `@${conversacion.username}`
          : null);
      const idExterno = `wa:${conversacionId}`;

      const alta = await this.leadsGestion.crearDesdeWhatsApp({
        organizacionId,
        idExterno,
        nombre,
        email: null,
        telefono,
        tipoLead: null,
        datosCrudos: {
          origen: 'whatsapp_chat',
          conversacionId,
          waId: conversacion.waId,
          bsuid: conversacion.bsuid,
          username: conversacion.username,
          automatico: true,
        },
        usuarioId: null,
        asignadoUsuarioId: null,
        historialId: randomUUID(),
      });
      leadId = alta.id;
      creado = alta.creado;

      if (!creado && conversacion.waId) {
        const porTelefono = await this.leadsGestion.buscarIdPorTelefonoSufijo(
          organizacionId,
          conversacion.waId,
        );
        if (porTelefono) leadId = porTelefono;
      }
    }

    await this.conversaciones.asignarLeadSiLibre(
      organizacionId,
      conversacionId,
      leadId,
    );

    return this.intentarAutoAsignarExistente(
      organizacionId,
      conversacionId,
      leadId,
      etiqueta,
      creado,
    );
  }

  private async intentarAutoAsignarExistente(
    organizacionId: string,
    conversacionId: string,
    leadId: string,
    nombreLead: string,
    creado: boolean,
  ): Promise<ResultadoAsegurarLeadWhatsApp> {
    let asignadoUsuarioId: string | null = null;
    let fueAutoAsignado = false;
    try {
      const asignacion = await this.autoAsignarLead.execute(
        organizacionId,
        leadId,
      );
      asignadoUsuarioId = asignacion.asignadoUsuarioId;
      fueAutoAsignado = asignacion.fueAutoAsignado;
    } catch (error: unknown) {
      this.logger.error(
        `Error auto-asignando lead WA ${leadId}`,
        error instanceof Error ? error.stack : error,
      );
    }

    if (creado || fueAutoAsignado) {
      void this.crearNotificacion
        .execute({
          organizacionId,
          tipo: 'LEAD_NUEVO',
          titulo: 'Nuevo lead',
          mensaje: creado
            ? `Llegó un nuevo lead desde WhatsApp: ${nombreLead}`
            : `Lead de WhatsApp asignado: ${nombreLead}`,
          payload: {
            leadId,
            url: `/leads/${leadId}`,
            whatsappConversacionId: conversacionId,
          },
          usuarioIds: asignadoUsuarioId ? [asignadoUsuarioId] : undefined,
        })
        .catch((error: unknown) =>
          this.logger.error(
            'Error creando notificación de lead nuevo (WhatsApp)',
            error instanceof Error ? error.stack : error,
          ),
        );
    }

    return {
      leadId,
      creado,
      fueAutoAsignado,
      asignadoUsuarioId,
    };
  }
}
