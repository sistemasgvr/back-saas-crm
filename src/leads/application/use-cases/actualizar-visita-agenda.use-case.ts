import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

const ESTADOS_VISITA = new Set([
  'PROGRAMADA',
  'REALIZADA',
  'NO_SHOW',
  'CANCELADA',
]);

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
export class ActualizarVisitaAgendaUseCase {
  constructor(
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  async execute(
    organizacionId: string,
    visitaId: string,
    input: {
      programadaEn?: string;
      duracionMinutos?: number;
      referenciaInmueble?: string;
      modalidad?: string;
      estado?: string;
      resultado?: string;
      feedback?: string;
      nota?: string;
      asignadoUsuarioId?: string;
    },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const visita = await this.visitas.obtenerPorId(organizacionId, visitaId);
    if (!visita) {
      throw new NotFoundException('Visita no encontrada');
    }

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    if (
      !esAdmin &&
      visita.asignadoUsuarioId &&
      visita.asignadoUsuarioId !== ctx.usuarioId
    ) {
      throw new ForbiddenException('No puedes modificar visitas de otro asesor');
    }

    const cambios: Parameters<LeadVisitasRepository['actualizar']>[2] = {};
    let nuevoAsignadoId: string | null | undefined;

    if (input.asignadoUsuarioId !== undefined) {
      if (!esAdmin) {
        throw new ForbiddenException('Solo un admin puede reasignar visitas');
      }
      if (input.asignadoUsuarioId !== visita.asignadoUsuarioId) {
        nuevoAsignadoId = input.asignadoUsuarioId;
        cambios.asignadoUsuarioId = input.asignadoUsuarioId;
      }
    }

    const reagenda =
      input.programadaEn !== undefined || input.duracionMinutos !== undefined;

    if (reagenda) {
      const programadaEn = input.programadaEn
        ? new Date(input.programadaEn)
        : visita.programadaEn;
      if (Number.isNaN(programadaEn.getTime())) {
        throw new BadRequestException('Fecha/hora de visita inválida');
      }
      const duracionMinutos = normalizarDuracionMinutos(
        input.duracionMinutos ?? visita.duracionMinutos,
      );
      const programadaFin = calcularProgramadaFin(programadaEn, duracionMinutos);

      if (esVisitaEnPasado(programadaEn)) {
        throw new BadRequestException(mensajeVisitaPasado());
      }
      if (!estaEnHorarioLaboral(programadaEn, programadaFin)) {
        throw new BadRequestException(mensajeHorarioLaboral());
      }

      const asignadoId =
        nuevoAsignadoId !== undefined
          ? nuevoAsignadoId
          : visita.asignadoUsuarioId;
      if (asignadoId) {
        const solapa = await this.visitas.existeSolape(
          organizacionId,
          asignadoId,
          programadaEn,
          programadaFin,
          visita.id,
        );
        const solapaAct = await this.actividades.existeSolape(
          organizacionId,
          asignadoId,
          programadaEn,
          programadaFin,
        );
        if (solapa || solapaAct) {
          throw new ConflictException(mensajeSolapeVisita());
        }
      }

      cambios.programadaEn = programadaEn;
      cambios.programadaFin = programadaFin;
      cambios.duracionMinutos = duracionMinutos;
    } else if (nuevoAsignadoId) {
      const solapa = await this.visitas.existeSolape(
        organizacionId,
        nuevoAsignadoId,
        visita.programadaEn,
        visita.programadaFin,
        visita.id,
      );
      const solapaAct = await this.actividades.existeSolape(
        organizacionId,
        nuevoAsignadoId,
        visita.programadaEn,
        visita.programadaFin,
      );
      if (solapa || solapaAct) {
        throw new ConflictException(mensajeSolapeVisita());
      }
    }

    if (input.referenciaInmueble !== undefined) {
      const ref = input.referenciaInmueble.trim();
      if (!ref) throw new BadRequestException('Indica el inmueble o proyecto');
      cambios.referenciaInmueble = ref;
    }

    if (input.modalidad !== undefined) {
      cambios.modalidad =
        input.modalidad === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL';
    }

    if (input.nota !== undefined) {
      cambios.nota = input.nota.trim() || null;
    }

    if (input.feedback !== undefined) {
      cambios.feedback = input.feedback.trim() || null;
    }

    if (input.estado !== undefined) {
      if (!ESTADOS_VISITA.has(input.estado)) {
        throw new BadRequestException('Estado de visita inválido');
      }
      cambios.estado = input.estado;
      if (input.estado === 'REALIZADA') {
        cambios.resultado = input.resultado ?? 'ASISTIO';
      } else if (input.estado === 'NO_SHOW') {
        cambios.resultado = input.resultado ?? 'NO_SHOW';
      } else if (input.estado === 'CANCELADA') {
        cambios.resultado = input.resultado ?? 'CANCELADA';
      }
    } else if (input.resultado !== undefined) {
      cambios.resultado = input.resultado;
    }

    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('No hay cambios para aplicar');
    }

    const actualizada = await this.visitas.actualizar(
      organizacionId,
      visitaId,
      cambios,
    );

    if (
      nuevoAsignadoId &&
      nuevoAsignadoId !== ctx.usuarioId
    ) {
      const programadaEn = cambios.programadaEn ?? visita.programadaEn;
      const cuandoIso = programadaEn.toISOString();
      const leadNombre = actualizada.leadNombre?.trim() || 'Lead';
      void this.crearNotificacion
        .execute({
          organizacionId,
          tipo: 'AGENDA_ASIGNADA',
          titulo: 'Nueva visita asignada',
          mensaje: `${leadNombre} · ${formatearCuandoAgenda(programadaEn)}`,
          payload: {
            url: `/agenda?visitaId=${actualizada.id}&cuando=${encodeURIComponent(cuandoIso)}`,
            cuando: cuandoIso,
            visitaId: actualizada.id,
            leadId: actualizada.leadId,
            origen: 'VISITA',
          },
          usuarioIds: [nuevoAsignadoId],
        })
        .catch(() => undefined);
    }

    return actualizada;
  }
}
