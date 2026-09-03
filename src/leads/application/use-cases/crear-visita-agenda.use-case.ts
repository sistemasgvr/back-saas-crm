import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import {
  calcularProgramadaFin,
  estaEnHorarioLaboral,
  esVisitaEnPasado,
  mensajeHorarioLaboral,
  mensajeSolapeVisita,
  mensajeVisitaPasado,
  normalizarDuracionMinutos,
} from '../../../shared/domain/agenda-visitas';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';
import { LEAD_ACTIVIDADES_REPOSITORY } from '../ports/lead-actividades.repository.port';
import type { LeadActividadesRepository } from '../ports/lead-actividades.repository.port';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

@Injectable()
export class CrearVisitaAgendaUseCase {
  constructor(
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
  ) {}

  async execute(
    organizacionId: string,
    input: {
      leadId: string;
      programadaEn: string;
      duracionMinutos?: number;
      referenciaInmueble: string;
      modalidad?: string;
      nota?: string;
      asignadoUsuarioId?: string;
    },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const lead = await this.leads.buscarParaGestion(organizacionId, input.leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    if (
      !esAdmin &&
      lead.asignadoUsuarioId &&
      lead.asignadoUsuarioId !== ctx.usuarioId
    ) {
      throw new ForbiddenException('No puedes agendar visitas de leads de otro asesor');
    }

    let asignadoUsuarioId: string | null =
      input.asignadoUsuarioId ?? lead.asignadoUsuarioId ?? ctx.usuarioId;

    if (!esAdmin) {
      if (input.asignadoUsuarioId && input.asignadoUsuarioId !== ctx.usuarioId) {
        throw new ForbiddenException('Solo puedes agendar visitas a tu nombre');
      }
      asignadoUsuarioId = ctx.usuarioId;
    }

    const programadaEn = new Date(input.programadaEn);
    if (Number.isNaN(programadaEn.getTime())) {
      throw new BadRequestException('Fecha/hora de visita inválida');
    }

    const duracionMinutos = normalizarDuracionMinutos(input.duracionMinutos);
    const programadaFin = calcularProgramadaFin(programadaEn, duracionMinutos);
    const modalidad = input.modalidad === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL';
    const referenciaInmueble = input.referenciaInmueble.trim();
    if (!referenciaInmueble) {
      throw new BadRequestException('Indica el inmueble o proyecto');
    }

    if (esVisitaEnPasado(programadaEn)) {
      throw new BadRequestException(mensajeVisitaPasado());
    }
    if (!estaEnHorarioLaboral(programadaEn, programadaFin)) {
      throw new BadRequestException(mensajeHorarioLaboral());
    }

    if (asignadoUsuarioId) {
      const solapa = await this.visitas.existeSolape(
        organizacionId,
        asignadoUsuarioId,
        programadaEn,
        programadaFin,
      );
      const solapaAct = await this.actividades.existeSolape(
        organizacionId,
        asignadoUsuarioId,
        programadaEn,
        programadaFin,
      );
      if (solapa || solapaAct) {
        throw new ConflictException(mensajeSolapeVisita());
      }
    }

    await this.visitas.cancelarProgramadasDelLead(organizacionId, input.leadId);

    return this.visitas.crear(organizacionId, {
      id: randomUUID(),
      leadId: input.leadId,
      programadaEn,
      programadaFin,
      duracionMinutos,
      referenciaInmueble,
      modalidad,
      nota: input.nota?.trim() || null,
      asignadoUsuarioId,
      creadoPorUsuarioId: ctx.usuarioId,
    });
  }
}
