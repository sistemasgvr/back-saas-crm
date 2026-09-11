import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LEADS_GESTION_REPOSITORY } from '../../../../leads/application/ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../../../../leads/application/ports/leads-gestion.repository.port';
import type { RolOrganizacion } from '../../../../auth/domain/request-context.interface';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';

const TIPOS_LEAD = new Set(['COMPRA', 'VENTA', 'OTRO']);

export interface CrearLeadDesdeChatInput {
  nombre?: string;
  email?: string;
  telefono?: string;
  tipoLead?: string;
}

/** CTA "Crear lead" desde un chat sin vincular — alta manual + vínculo 1:1. */
@Injectable()
export class CrearLeadDesdeConversacionWhatsAppUseCase {
  constructor(
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leadsGestion: LeadsGestionRepository,
  ) {}

  async execute(
    organizacionId: string,
    conversacionId: string,
    ctx: { usuarioId: string; rol: RolOrganizacion },
    input: CrearLeadDesdeChatInput,
  ) {
    const conversacion = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }
    if (conversacion.lead) {
      throw new ConflictException('Este chat ya tiene un lead vinculado');
    }

    const nombre =
      input.nombre?.trim() ||
      conversacion.nombreContacto?.trim() ||
      null;
    const email = input.email?.trim().toLowerCase() || null;
    const telefonoRaw =
      input.telefono?.trim() ||
      (conversacion.waId ? `+${conversacion.waId}` : null);
    if (!telefonoRaw) {
      throw new BadRequestException('Se necesita un teléfono para crear el lead');
    }

    let tipoLead: string | null = null;
    if (input.tipoLead != null && input.tipoLead !== '') {
      const t = input.tipoLead.trim().toUpperCase();
      if (!TIPOS_LEAD.has(t)) {
        throw new BadRequestException('tipoLead inválido');
      }
      tipoLead = t;
    }

    const idExterno = `wa:${conversacionId}`;
    const { id: leadId, creado } = await this.leadsGestion.crearDesdeWhatsApp({
      organizacionId,
      idExterno,
      nombre,
      email,
      telefono: telefonoRaw,
      tipoLead,
      datosCrudos: {
        origen: 'whatsapp_chat',
        conversacionId,
        waId: conversacion.waId,
      },
      usuarioId: ctx.usuarioId,
      asignadoUsuarioId: ctx.usuarioId,
      historialId: randomUUID(),
    });

    const vinculada = await this.conversaciones.asignarLeadSiLibre(
      organizacionId,
      conversacionId,
      leadId,
    );
    if (!vinculada && creado) {
      // Lead creado pero otro request vinculó primero — no es fatal.
    }
    if (!vinculada && !creado) {
      // Lead previo (mismo idExterno): reintentar vínculo.
      await this.conversaciones.asignarLeadSiLibre(
        organizacionId,
        conversacionId,
        leadId,
      );
    }

    // Confirmar estado tras el vínculo.
    const actualizada = await this.conversaciones.findPorId(
      organizacionId,
      conversacionId,
    );
    if (!actualizada?.lead) {
      throw new ConflictException(
        'No se pudo vincular el lead a la conversación',
      );
    }

    return {
      leadId,
      creado,
      lead: actualizada.lead,
    };
  }
}
