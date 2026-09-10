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
import { CrearNotificacionUseCase } from '../../../notifications/application/use-cases/crear-notificacion.use-case';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';
import { LEAD_ACTIVIDADES_REPOSITORY } from '../ports/lead-actividades.repository.port';
import type { LeadActividadesRepository } from '../ports/lead-actividades.repository.port';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

function formatearCuandoAgenda(programadaEn: Date): string {
  return programadaEn.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

@Injectable()
export class CrearVisitaAgendaUseCase {
  constructor(
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  async execute(
    organizacionId: string,
    input: {
      leadId: string;
      programadaEn: string;
      duracionMinutos?: number;
      referenciaInmueble: string;
      inmuebleId?: string;
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

    const creada = await this.visitas.crear(organizacionId, {
      id: randomUUID(),
      leadId: input.leadId,
      programadaEn,
      programadaFin,
      duracionMinutos,
      referenciaInmueble,
      inmuebleId: input.inmuebleId ?? null,
      modalidad,
      nota: input.nota?.trim() || null,
      asignadoUsuarioId,
      creadoPorUsuarioId: ctx.usuarioId,
    });

    if (asignadoUsuarioId && asignadoUsuarioId !== ctx.usuarioId) {
      const cuandoIso = programadaEn.toISOString();
      const leadNombre = creada.leadNombre?.trim() || 'Lead';
      void this.crearNotificacion
        .execute({
          organizacionId,
          tipo: 'AGENDA_ASIGNADA',
          titulo: 'Nueva visita asignada',
          mensaje: `${leadNombre} · ${formatearCuandoAgenda(programadaEn)}`,
          payload: {
            url: `/agenda?visitaId=${creada.id}&cuando=${encodeURIComponent(cuandoIso)}`,
            cuando: cuandoIso,
            visitaId: creada.id,
            leadId: creada.leadId,
            origen: 'VISITA',
          },
          usuarioIds: [asignadoUsuarioId],
        })
        .catch(() => undefined);
    }

    return creada;
  }
}
