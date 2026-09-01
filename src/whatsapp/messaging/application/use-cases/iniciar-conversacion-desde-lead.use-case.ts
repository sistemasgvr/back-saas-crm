import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LEADS_LECTURA_REPOSITORY } from '../../../../leads/application/ports/leads-lectura.repository.port';
import type { LeadsLecturaRepository } from '../../../../leads/application/ports/leads-lectura.repository.port';
import { WHATSAPP_CONEXIONES_REPOSITORY } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import type { WhatsappConexionesRepository } from '../../../connections/application/ports/whatsapp-conexiones.repository.port';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from '../ports/whatsapp-conversaciones.repository.port';
import type { WhatsappConversacionesRepository } from '../ports/whatsapp-conversaciones.repository.port';
import { telefonoAWaId } from '../../infrastructure/normalizar-telefono';

/** CTA "Iniciar chat" desde la ficha del lead — crea (o reusa) la
 * conversación aunque el lead nunca haya escrito por WhatsApp; el primer
 * envío deberá ser una plantilla aprobada (fuera de la ventana 24h, PLAN §3). */
@Injectable()
export class IniciarConversacionDesdeLeadUseCase {
  constructor(
    @Inject(LEADS_LECTURA_REPOSITORY)
    private readonly leads: LeadsLecturaRepository,
    @Inject(WHATSAPP_CONEXIONES_REPOSITORY)
    private readonly whatsappConexiones: WhatsappConexionesRepository,
    @Inject(WHATSAPP_CONVERSACIONES_REPOSITORY)
    private readonly conversaciones: WhatsappConversacionesRepository,
  ) {}

  async execute(organizacionId: string, leadId: string) {
    const lead = await this.leads.obtenerPorId(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }
    if (!lead.telefono) {
      throw new BadRequestException('Este lead no tiene teléfono registrado');
    }
    const waId = telefonoAWaId(lead.telefono);
    if (!waId) {
      throw new BadRequestException(
        `No se pudo interpretar el teléfono "${lead.telefono}" como un número de WhatsApp válido`,
      );
    }

    const [conexion] =
      await this.whatsappConexiones.listarPorOrganizacion(organizacionId);
    if (!conexion) {
      throw new NotFoundException(
        'No hay un número de WhatsApp vinculado a esta organización',
      );
    }

    const { id } = await this.conversaciones.findOCrearConversacion({
      organizacionId,
      whatsappConexionId: conexion.id,
      waId,
      nombreContacto: lead.nombre ?? undefined,
      leadIdConocido: leadId,
    });

    return { conversacionId: id };
  }
}
