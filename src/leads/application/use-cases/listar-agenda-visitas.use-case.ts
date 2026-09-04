import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';
import { LEAD_ACTIVIDADES_REPOSITORY } from '../ports/lead-actividades.repository.port';
import type { LeadActividadesRepository } from '../ports/lead-actividades.repository.port';

/** Ítem unificado de calendario: visitas del pipeline + actividades de agenda. */
export interface AgendaItemRow {
  id: string;
  origen: 'visita' | 'actividad';
  tipo: string;
  titulo: string;
  leadId: string;
  leadNombre: string | null;
  leadTelefono: string | null;
  programadaEn: Date;
  programadaFin: Date;
  duracionMinutos: number;
  referenciaInmueble: string | null;
  inmuebleId: string | null;
  inmueble: { id: string; codigo: string; titulo: string } | null;
  modalidad: string | null;
  estado: string;
  nota: string | null;
  asignado: { id: string; nombre: string } | null;
}

@Injectable()
export class ListarAgendaVisitasUseCase {
  constructor(
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
  ) {}

  async execute(
    organizacionId: string,
    query: { desde: string; hasta: string; asignado?: string },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<AgendaItemRow[]> {
    const desde = new Date(query.desde);
    const hasta = new Date(query.hasta);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    if (desde.getTime() > hasta.getTime()) {
      throw new BadRequestException('El rango de fechas es inválido (desde > hasta)');
    }

    const esAdmin = ['PROPIETARIO', 'ADMINISTRADOR'].includes(ctx.rol);
    let asignadoUsuarioId: string | undefined;

    if (!esAdmin) {
      asignadoUsuarioId = ctx.usuarioId;
    } else if (!query.asignado || query.asignado === 'todos') {
      asignadoUsuarioId = undefined;
    } else if (query.asignado === 'mios') {
      asignadoUsuarioId = ctx.usuarioId;
    } else {
      asignadoUsuarioId = query.asignado;
    }

    const filtros = { desde, hasta, asignadoUsuarioId };
    const [visitas, actividades] = await Promise.all([
      this.visitas.listarAgenda(organizacionId, filtros),
      this.actividades.listarAgenda(organizacionId, filtros),
    ]);

    const items: AgendaItemRow[] = [
      ...visitas.map((v) => ({
        id: v.id,
        origen: 'visita' as const,
        tipo: 'VISITA',
        titulo: v.referenciaInmueble,
        leadId: v.leadId,
        leadNombre: v.leadNombre,
        leadTelefono: v.leadTelefono,
        programadaEn: v.programadaEn,
        programadaFin: v.programadaFin,
        duracionMinutos: v.duracionMinutos,
        referenciaInmueble: v.referenciaInmueble,
        inmuebleId: v.inmuebleId,
        inmueble: v.inmueble,
        modalidad: v.modalidad,
        estado: v.estado,
        nota: v.nota,
        asignado: v.asignado,
      })),
      ...actividades.map((a) => ({
        id: a.id,
        origen: 'actividad' as const,
        tipo: a.tipo,
        titulo: a.titulo,
        leadId: a.leadId,
        leadNombre: a.leadNombre,
        leadTelefono: a.leadTelefono,
        programadaEn: a.programadaEn,
        programadaFin: a.programadaFin,
        duracionMinutos: a.duracionMinutos,
        referenciaInmueble: a.referenciaInmueble,
        inmuebleId: null,
        inmueble: null,
        modalidad: a.modalidad,
        estado: a.estado,
        nota: a.nota,
        asignado: a.asignado,
      })),
    ];

    items.sort(
      (a, b) => a.programadaEn.getTime() - b.programadaEn.getTime(),
    );
    return items;
  }
}
