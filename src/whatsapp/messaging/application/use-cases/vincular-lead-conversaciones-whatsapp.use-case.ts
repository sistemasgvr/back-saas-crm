import { Inject, Injectable, Logger } from '@nestjs/common';
import { LEADS_LECTURA_REPOSITORY } from '../../../../leads/application/ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../../../../leads/application/ports/leads-lectura.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';

/** Cuando un lead de Meta llega (o ya existía) con teléfono, intenta vincular
 * conversaciones de WhatsApp que ya existían sin lead_id — típico: el contacto
 * escribió primero y después llenó el formulario. */
@Injectable()
export class VincularLeadConversacionesWhatsAppUseCase {
  private readonly logger = new Logger(VincularLeadConversacionesWhatsAppUseCase.name);

  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    telefonoConocido?: string | null,
  ): Promise<{ vinculadas: number }> {
    const telefono =
      telefonoConocido?.trim() ||
      (await this.leads.obtenerPorId(organizacionId, leadId))?.telefono?.trim();
    if (!telefono) return { vinculadas: 0 };

    const vinculadas = await this.conversaciones.vincularLeadPorTelefono(
      organizacionId,
      leadId,
      telefono,
    );

    if (vinculadas > 0) {
      this.logger.log(
        `Lead ${leadId}: ${vinculadas} conversación(es) WhatsApp vinculada(s) por teléfono`,
      );
    }

    return { vinculadas };
  }
}
