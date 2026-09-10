import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CrearNotificacionUseCase } from '../../../notifications/application/use-cases/crear-notificacion.use-case';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

/** PROPIETARIO/ADMINISTRADOR eligen destinatario — cubre tanto la primera
 * asignación como reasignar uno que ya tenía dueño (PLAN §3: "Reasignar:
 * solo admin/propietario" reusa este mismo endpoint). */
@Injectable()
export class AsignarLeadUseCase {
  constructor(
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    usuarioDestinoId: string,
    asignadoPorUsuarioId: string,
  ): Promise<void> {
    const lead = await this.leads.buscarParaGestion(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    if (lead.asignadoUsuarioId === usuarioDestinoId) {
      return;
    }

    const esMiembro = await this.leads.esMiembroActivo(
      organizacionId,
      usuarioDestinoId,
    );
    if (!esMiembro) {
      throw new BadRequestException(
        'El usuario destino no es miembro activo de esta organización',
      );
    }

    await this.leads.asignar(
      organizacionId,
      leadId,
      usuarioDestinoId,
      asignadoPorUsuarioId,
    );

    if (usuarioDestinoId !== asignadoPorUsuarioId) {
      const nombre = lead.nombre?.trim();
      void this.crearNotificacion
        .execute({
          organizacionId,
          tipo: 'LEAD_ASIGNADO',
          titulo: 'Lead asignado',
          mensaje: nombre
            ? `Te asignaron el lead "${nombre}"`
            : 'Te asignaron un lead',
          payload: { leadId, url: `/leads/${leadId}` },
          usuarioIds: [usuarioDestinoId],
        })
        .catch(() => undefined);
    }
  }
}
