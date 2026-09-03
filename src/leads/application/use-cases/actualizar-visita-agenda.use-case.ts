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

@Injectable()
export class ActualizarVisitaAgendaUseCase {
  constructor(
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
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

      const asignadoId = visita.asignadoUsuarioId;
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

    return this.visitas.actualizar(organizacionId, visitaId, cambios);
  }
}
