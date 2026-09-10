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
import {
  esTipoActividadAgenda,
  tituloDefaultActividad,
  type TipoActividadAgenda,
} from '../../../shared/domain/agenda-actividades';
import { CrearNotificacionUseCase } from '../../../notifications/application/use-cases/crear-notificacion.use-case';
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';
import { LEAD_ACTIVIDADES_REPOSITORY } from '../ports/lead-actividades.repository.port';
import type { LeadActividadesRepository } from '../ports/lead-actividades.repository.port';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';

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
export class CrearActividadAgendaUseCase {
  constructor(
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  async execute(
    organizacionId: string,
    input: {
      leadId: string;
      tipo: string;
      titulo?: string;
      programadaEn: string;
      duracionMinutos?: number;
      referenciaInmueble?: string;
      modalidad?: string;
      nota?: string;
      asignadoUsuarioId?: string;
    },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    if (!esTipoActividadAgenda(input.tipo)) {
      throw new BadRequestException('Tipo de actividad inválido');
    }
    const tipo = input.tipo as TipoActividadAgenda;

    const lead = await this.leads.buscarParaGestion(organizacionId, input.leadId);
    if (!lead) throw new NotFoundException('Lead no encontrado');

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    if (
      !esAdmin &&
      lead.asignadoUsuarioId &&
      lead.asignadoUsuarioId !== ctx.usuarioId
    ) {
      throw new ForbiddenException(
        'No puedes agendar actividades de leads de otro asesor',
      );
    }

    let asignadoUsuarioId: string | null =
      input.asignadoUsuarioId ?? lead.asignadoUsuarioId ?? ctx.usuarioId;
    if (!esAdmin) {
      if (input.asignadoUsuarioId && input.asignadoUsuarioId !== ctx.usuarioId) {
        throw new ForbiddenException('Solo puedes agendar actividades a tu nombre');
      }
      asignadoUsuarioId = ctx.usuarioId;
    }

    const programadaEn = new Date(input.programadaEn);
    if (Number.isNaN(programadaEn.getTime())) {
      throw new BadRequestException('Fecha/hora inválida');
    }

    const duracionMinutos = normalizarDuracionMinutos(input.duracionMinutos);
    const programadaFin = calcularProgramadaFin(programadaEn, duracionMinutos);

    if (esVisitaEnPasado(programadaEn)) {
      throw new BadRequestException(mensajeVisitaPasado());
    }
    if (!estaEnHorarioLaboral(programadaEn, programadaFin)) {
      throw new BadRequestException(mensajeHorarioLaboral());
    }

    let referenciaInmueble: string | null = null;
    let modalidad: string | null = null;
    if (tipo === 'VISITA') {
      referenciaInmueble = input.referenciaInmueble?.trim() || null;
      if (!referenciaInmueble) {
        throw new BadRequestException('Indica el inmueble o proyecto de la visita');
      }
      modalidad = input.modalidad === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL';
    }

    const titulo =
      input.titulo?.trim() ||
      tituloDefaultActividad(tipo, referenciaInmueble);

    if (asignadoUsuarioId) {
      const solapaVisita = await this.visitas.existeSolape(
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
      if (solapaVisita || solapaAct) {
        throw new ConflictException(mensajeSolapeVisita());
      }
    }

    const creada = await this.actividades.crear(organizacionId, {
      id: randomUUID(),
      leadId: input.leadId,
      tipo,
      titulo,
      programadaEn,
      programadaFin,
      duracionMinutos,
      referenciaInmueble,
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
          titulo: 'Nueva actividad asignada',
          mensaje: `${leadNombre} · ${titulo} · ${formatearCuandoAgenda(programadaEn)}`,
          payload: {
            url: `/agenda?actividadId=${creada.id}&cuando=${encodeURIComponent(cuandoIso)}`,
            cuando: cuandoIso,
            actividadId: creada.id,
            leadId: creada.leadId,
            origen: 'ACTIVIDAD',
          },
          usuarioIds: [asignadoUsuarioId],
        })
        .catch(() => undefined);
    }

    return {
      origen: 'actividad' as const,
      ...creada,
    };
  }
}
