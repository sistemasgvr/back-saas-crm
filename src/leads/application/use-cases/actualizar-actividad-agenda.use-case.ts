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
import {
  esEstadoActividadAgenda,
  esTipoActividadAgenda,
  tituloDefaultActividad,
  type TipoActividadAgenda,
} from '../../../shared/domain/agenda-actividades';
import { LEAD_ACTIVIDADES_REPOSITORY } from '../ports/lead-actividades.repository.port';
import type { LeadActividadesRepository } from '../ports/lead-actividades.repository.port';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

@Injectable()
export class ActualizarActividadAgendaUseCase {
  constructor(
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
  ) {}

  async execute(
    organizacionId: string,
    actividadId: string,
    input: {
      tipo?: string;
      titulo?: string;
      programadaEn?: string;
      duracionMinutos?: number;
      referenciaInmueble?: string;
      modalidad?: string;
      estado?: string;
      nota?: string;
    },
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ) {
    const actividad = await this.actividades.obtenerPorId(
      organizacionId,
      actividadId,
    );
    if (!actividad) throw new NotFoundException('Actividad no encontrada');

    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    if (
      !esAdmin &&
      actividad.asignadoUsuarioId &&
      actividad.asignadoUsuarioId !== ctx.usuarioId
    ) {
      throw new ForbiddenException(
        'No puedes modificar actividades de otro asesor',
      );
    }

    const cambios: Parameters<LeadActividadesRepository['actualizar']>[2] = {};

    if (input.tipo !== undefined) {
      if (!esTipoActividadAgenda(input.tipo)) {
        throw new BadRequestException('Tipo de actividad inválido');
      }
      cambios.tipo = input.tipo;
    }

    if (input.estado !== undefined) {
      if (!esEstadoActividadAgenda(input.estado)) {
        throw new BadRequestException('Estado de actividad inválido');
      }
      cambios.estado = input.estado;
    }

    if (input.nota !== undefined) {
      cambios.nota = input.nota.trim() || null;
    }

    const tipoEfectivo = (cambios.tipo ?? actividad.tipo) as TipoActividadAgenda;
    const reagenda =
      input.programadaEn !== undefined || input.duracionMinutos !== undefined;

    if (reagenda) {
      const programadaEn = input.programadaEn
        ? new Date(input.programadaEn)
        : actividad.programadaEn;
      if (Number.isNaN(programadaEn.getTime())) {
        throw new BadRequestException('Fecha/hora inválida');
      }
      const duracionMinutos = normalizarDuracionMinutos(
        input.duracionMinutos ?? actividad.duracionMinutos,
      );
      const programadaFin = calcularProgramadaFin(programadaEn, duracionMinutos);

      if (esVisitaEnPasado(programadaEn)) {
        throw new BadRequestException(mensajeVisitaPasado());
      }
      if (!estaEnHorarioLaboral(programadaEn, programadaFin)) {
        throw new BadRequestException(mensajeHorarioLaboral());
      }

      if (actividad.asignadoUsuarioId) {
        const solapaVisita = await this.visitas.existeSolape(
          organizacionId,
          actividad.asignadoUsuarioId,
          programadaEn,
          programadaFin,
        );
        const solapaAct = await this.actividades.existeSolape(
          organizacionId,
          actividad.asignadoUsuarioId,
          programadaEn,
          programadaFin,
          actividad.id,
        );
        if (solapaVisita || solapaAct) {
          throw new ConflictException(mensajeSolapeVisita());
        }
      }

      cambios.programadaEn = programadaEn;
      cambios.programadaFin = programadaFin;
      cambios.duracionMinutos = duracionMinutos;
    }

    if (tipoEfectivo === 'VISITA') {
      if (input.referenciaInmueble !== undefined) {
        const ref = input.referenciaInmueble.trim();
        if (!ref) {
          throw new BadRequestException('Indica el inmueble o proyecto');
        }
        cambios.referenciaInmueble = ref;
      }
      if (input.modalidad !== undefined) {
        cambios.modalidad =
          input.modalidad === 'VIRTUAL' ? 'VIRTUAL' : 'PRESENCIAL';
      }
    } else if (cambios.tipo && cambios.tipo !== 'VISITA') {
      cambios.referenciaInmueble = null;
      cambios.modalidad = null;
    }

    if (input.titulo !== undefined) {
      cambios.titulo = input.titulo.trim() || tituloDefaultActividad(tipoEfectivo);
    } else if (cambios.referenciaInmueble && tipoEfectivo === 'VISITA') {
      cambios.titulo = tituloDefaultActividad(
        'VISITA',
        cambios.referenciaInmueble,
      );
    }

    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('No hay cambios para aplicar');
    }

    const actualizada = await this.actividades.actualizar(
      organizacionId,
      actividadId,
      cambios,
    );
    return { origen: 'actividad' as const, ...actualizada };
  }
}
