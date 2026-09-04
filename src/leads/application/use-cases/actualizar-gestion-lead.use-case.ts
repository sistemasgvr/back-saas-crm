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
import { LEADS_GESTION_REPOSITORY } from '../ports/leads-gestion.repository.port';
import type { LeadsGestionRepository } from '../ports/leads-gestion.repository.port';
import { EnviarEventoConversionLeadUseCase } from './enviar-evento-conversion-lead.use-case';
import { TIPOS_LEAD_INMOBILIARIA } from '../../../shared/domain/tipos-lead-inmobiliaria';
import {
  esEstadoTerminal,
  esReaperturaValida,
  esTransicionValida,
  estadoAlCambiarTipo,
  estadosPorTipo,
  cambioTipoReiniciaEmbudo,
  ESTADO_TRAS_REINICIO_POR_CAMBIO_TIPO,
  MOTIVOS_DESCARTE,
  MOTIVOS_PERDIDO,
  motivosGanado,
  parsePipelineConfig,
  requiereTipoLeadDefinido,
  debeClasificarTipoDesdeNuevo,
  tipoLeadClasificado,
} from '../../../shared/domain/pipeline-inmobiliaria';
import {
  extraerMetadataTransicion,
  validarTransicionPipeline,
} from '../../../shared/domain/campos-transicion-pipeline';
import {
  construirCalificacionDesdeMetadata,
  construirCierreVisitaDesdeMetadata,
  construirVisitaDesdeMetadata,
  metadataHistorialLigera,
} from '../../../shared/domain/entidades-transicion-pipeline';
import {
  estaEnHorarioLaboral,
  esVisitaEnPasado,
  mensajeHorarioLaboral,
  mensajeSolapeVisita,
  mensajeVisitaPasado,
} from '../../../shared/domain/agenda-visitas';
import { LEAD_VISITAS_REPOSITORY } from '../ports/lead-visitas.repository.port';
import type { LeadVisitasRepository } from '../ports/lead-visitas.repository.port';
import { LEAD_ACTIVIDADES_REPOSITORY } from '../ports/lead-actividades.repository.port';
import type { LeadActividadesRepository } from '../ports/lead-actividades.repository.port';
import { ORGANIZACIONES_REPOSITORY } from '../../../organizations/application/ports/organizaciones.repository.port';
import type { OrganizacionesRepository } from '../../../organizations/application/ports/organizaciones.repository.port';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

export interface ActualizarGestionInput {
  tipoLead?: string;
  estadoGestion?: string;
  motivoCierre?: string | null;
  notaCierre?: string | null;
  notaTransicion?: string | null;
  metadata?: Record<string, unknown> | null;
}

function motivosValidosParaEstado(
  estadoGestion: string,
  tipoLead: string | null,
): readonly string[] | null {
  if (estadoGestion === 'DESCARTADO') return MOTIVOS_DESCARTE;
  if (estadoGestion === 'CERRADO_PERDIDO') return MOTIVOS_PERDIDO;
  if (estadoGestion === 'CERRADO_GANADO') return motivosGanado(tipoLead);
  return null;
}

/** PATCH /leads/:id/gestion — tipoLead + estadoGestion + motivo/nota de
 * cierre, todo opcional y validado contra la máquina de estados de
 * PLAN-PIPELINE-INMOBILIARIA.md. Reemplaza a la vieja ActualizarTipoLeadUseCase
 * (G2), que no conocía el pipeline todavía. */
@Injectable()
export class ActualizarGestionLeadUseCase {
  constructor(
    @Inject(LEADS_GESTION_REPOSITORY)
    private readonly leads: LeadsGestionRepository,
    @Inject(LEAD_VISITAS_REPOSITORY)
    private readonly visitas: LeadVisitasRepository,
    @Inject(LEAD_ACTIVIDADES_REPOSITORY)
    private readonly actividades: LeadActividadesRepository,
    @Inject(ORGANIZACIONES_REPOSITORY)
    private readonly organizaciones: OrganizacionesRepository,
    private readonly enviarEventoCapi: EnviarEventoConversionLeadUseCase,
  ) {}

  async execute(
    organizacionId: string,
    leadId: string,
    input: ActualizarGestionInput,
    ctx: { usuarioId: string; rol: RolOrganizacion },
  ): Promise<void> {
    if (
      input.tipoLead !== undefined &&
      !TIPOS_LEAD_INMOBILIARIA.includes(input.tipoLead as never)
    ) {
      throw new BadRequestException(
        `tipoLead debe ser uno de: ${TIPOS_LEAD_INMOBILIARIA.join(', ')}`,
      );
    }

    const lead = await this.leads.buscarParaGestion(organizacionId, leadId);
    if (!lead) {
      throw new NotFoundException('Lead no encontrado');
    }

    const esDueno = lead.asignadoUsuarioId === ctx.usuarioId;
    const esAdmin = ROLES_ADMIN.includes(ctx.rol);
    if (!esDueno && !esAdmin) {
      throw new ForbiddenException(
        'Solo el dueño del lead o un administrador puede gestionar este lead',
      );
    }

    const override = parsePipelineConfig(
      await this.organizaciones.obtenerPipelineConfig(organizacionId),
    );

    // tipoLead efectivo tras este request (el nuevo si viene, si no el actual)
    // — determina qué matriz de transiciones aplica.
    const tipoLeadEfectivo = input.tipoLead ?? lead.tipoLead;

    let estadoGestionFinal = lead.estadoGestion;
    let reinicioPorCambioTipo = false;
    let notaReinicioTipo: string | null = null;

    // 1) Cambio de tipoLead — en etapas tempranas es libre; si ya avanzó,
    // reinicia el embudo a CONTACTADO y cancela visitas programadas.
    if (input.tipoLead !== undefined && input.tipoLead !== lead.tipoLead) {
      if (esEstadoTerminal(lead.estadoGestion)) {
        throw new BadRequestException(
          'No se puede cambiar el tipo de un lead cerrado',
        );
      }
      if (cambioTipoReiniciaEmbudo(lead.estadoGestion)) {
        reinicioPorCambioTipo = true;
        estadoGestionFinal = ESTADO_TRAS_REINICIO_POR_CAMBIO_TIPO;
        const tipoAnterior = lead.tipoLead ?? 'sin clasificar';
        notaReinicioTipo = `Tipo cambiado de ${tipoAnterior} a ${input.tipoLead}. Embudo reiniciado a Contactado.`;
      } else if (input.estadoGestion === undefined) {
        estadoGestionFinal = estadoAlCambiarTipo(lead.estadoGestion);
      }
    }

    // 2) Cambio explícito de estadoGestion — valida transición o reapertura.
    if (input.estadoGestion !== undefined) {
      const estadosValidos = estadosPorTipo(tipoLeadEfectivo, override);
      if (!(estadosValidos as readonly string[]).includes(input.estadoGestion)) {
        throw new BadRequestException(
          `estadoGestion inválido para este tipo de lead: ${input.estadoGestion}`,
        );
      }

      if (esEstadoTerminal(lead.estadoGestion)) {
        // Reabrir un lead cerrado — solo PROPIETARIO/ADMINISTRADOR, y solo
        // hacia CONTACTADO o CALIFICADO (§4.1.4).
        if (!esAdmin) {
          throw new ForbiddenException(
            'Solo un propietario o administrador puede reabrir un lead cerrado',
          );
        }
        if (!esReaperturaValida(lead.estadoGestion, input.estadoGestion)) {
          throw new BadRequestException(
            'Un lead cerrado solo puede reabrirse hacia Contactado o Calificado',
          );
        }
      } else {
        const tipoParaClasificar = input.tipoLead ?? lead.tipoLead;
        if (
          debeClasificarTipoDesdeNuevo(
            lead.estadoGestion,
            input.estadoGestion,
            tipoParaClasificar,
          )
        ) {
          throw new BadRequestException(
            'Clasifica el lead (Compra, Venta u Otro) antes de avanzar desde Nuevo',
          );
        }
        if (
          requiereTipoLeadDefinido(input.estadoGestion) &&
          !tipoLeadClasificado(tipoLeadEfectivo)
        ) {
          throw new ConflictException(
            'Define primero si el lead es de Compra o Venta para avanzar el pipeline más allá de Contactado',
          );
        }
        if (
          !esTransicionValida(
            tipoLeadEfectivo,
            lead.estadoGestion,
            input.estadoGestion,
            override,
          )
        ) {
          throw new BadRequestException(
            `No se puede pasar de ${lead.estadoGestion} a ${input.estadoGestion}`,
          );
        }
      }
      estadoGestionFinal = input.estadoGestion;
    }

    // 3) Motivo de cierre obligatorio (y válido) al entrar a un estado terminal.
    const motivosValidos = motivosValidosParaEstado(
      estadoGestionFinal,
      tipoLeadEfectivo,
    );
    const huboCambioDeEstado = estadoGestionFinal !== lead.estadoGestion;

    if (motivosValidos && huboCambioDeEstado) {
      const motivo = input.motivoCierre;
      if (!motivo || !motivosValidos.includes(motivo)) {
        throw new BadRequestException(
          `Hace falta un motivo válido para pasar a ${estadoGestionFinal}: ${motivosValidos.join(', ')}`,
        );
      }
    }

    // 4) Campos de transición (nota + metadata) según estado destino.
    let esReapertura = false;
    if (
      huboCambioDeEstado &&
      input.estadoGestion !== undefined &&
      esEstadoTerminal(lead.estadoGestion)
    ) {
      esReapertura = true;
    }

    if (huboCambioDeEstado && !motivosValidos && !reinicioPorCambioTipo) {
      const validacion = validarTransicionPipeline(
        tipoLeadEfectivo,
        estadoGestionFinal,
        {
          notaTransicion: input.notaTransicion,
          metadata: input.metadata,
        },
        { esReapertura },
      );
      if (!validacion.valido) {
        throw new BadRequestException(validacion.errores.join('. '));
      }
    }

    const metadataExtraida =
      huboCambioDeEstado && !motivosValidos && !reinicioPorCambioTipo
        ? extraerMetadataTransicion(
            tipoLeadEfectivo,
            estadoGestionFinal,
            input.metadata,
            { esReapertura },
          )
        : null;

    const metadataHistorial =
      huboCambioDeEstado && !motivosValidos && !reinicioPorCambioTipo
        ? metadataHistorialLigera(estadoGestionFinal, metadataExtraida)
        : null;

    const crearVisita =
      huboCambioDeEstado &&
      !reinicioPorCambioTipo &&
      estadoGestionFinal === 'VISITA_AGENDADA'
        ? construirVisitaDesdeMetadata(metadataExtraida, {
            asignadoUsuarioId: lead.asignadoUsuarioId,
            creadoPorUsuarioId: ctx.usuarioId,
            notaTransicion: input.notaTransicion,
          })
        : null;

    if (
      huboCambioDeEstado &&
      estadoGestionFinal === 'VISITA_AGENDADA' &&
      !crearVisita
    ) {
      throw new BadRequestException(
        'No se pudo registrar la visita — revisa fecha/hora e inmueble',
      );
    }

    if (crearVisita) {
      if (esVisitaEnPasado(crearVisita.programadaEn)) {
        throw new BadRequestException(mensajeVisitaPasado());
      }
      if (!estaEnHorarioLaboral(crearVisita.programadaEn, crearVisita.programadaFin)) {
        throw new BadRequestException(mensajeHorarioLaboral());
      }
      if (crearVisita.asignadoUsuarioId) {
        const solapa = await this.visitas.existeSolape(
          organizacionId,
          crearVisita.asignadoUsuarioId,
          crearVisita.programadaEn,
          crearVisita.programadaFin,
        );
        const solapaAct = await this.actividades.existeSolape(
          organizacionId,
          crearVisita.asignadoUsuarioId,
          crearVisita.programadaEn,
          crearVisita.programadaFin,
        );
        if (solapa || solapaAct) {
          throw new ConflictException(mensajeSolapeVisita());
        }
      }
    }

    const cerrarVisita =
      huboCambioDeEstado &&
      !reinicioPorCambioTipo &&
      estadoGestionFinal === 'VISITA_REALIZADA'
        ? construirCierreVisitaDesdeMetadata(
            metadataExtraida,
            input.notaTransicion,
          )
        : null;

    if (
      huboCambioDeEstado &&
      estadoGestionFinal === 'VISITA_REALIZADA' &&
      !cerrarVisita
    ) {
      throw new BadRequestException('Falta el resultado de la visita');
    }

    const crearCalificacion =
      huboCambioDeEstado &&
      !reinicioPorCambioTipo &&
      estadoGestionFinal === 'CALIFICADO'
        ? construirCalificacionDesdeMetadata(
            tipoLeadEfectivo,
            metadataExtraida,
            input.notaTransicion,
            ctx.usuarioId,
          )
        : null;

    if (
      huboCambioDeEstado &&
      estadoGestionFinal === 'CALIFICADO' &&
      !crearCalificacion
    ) {
      throw new BadRequestException('Falta la nota de calificación');
    }

    const notaHistorial = huboCambioDeEstado
      ? reinicioPorCambioTipo
        ? notaReinicioTipo
        : motivosValidos
          ? (input.notaCierre ?? null)
          : (input.notaTransicion ?? null)
      : null;

    // Solo un cambio de ESTADO es una fila de historial válida — el
    // historial es una línea de tiempo de transiciones de pipeline, no de
    // cualquier cambio. Un tipoLead nuevo que no mueve el estado (porque ya
    // era uno común a los tres embudos, regla §4.1.5) no genera fila: si no,
    // quedaría un renglón sin sentido tipo "Contactado → Contactado".
    const historialId = randomUUID();

    await this.leads.actualizarGestion(
      organizacionId,
      leadId,
      {
        tipoLead: input.tipoLead,
        estadoGestion: huboCambioDeEstado ? estadoGestionFinal : undefined,
        motivoCierre: input.motivoCierre,
        notaCierre: input.notaCierre,
      },
      ctx.usuarioId,
      huboCambioDeEstado
        ? {
            id: historialId,
            organizacionId,
            leadId,
            tipoLead: tipoLeadEfectivo,
            desde: lead.estadoGestion,
            hacia: estadoGestionFinal,
            motivoCierre: input.motivoCierre,
            nota: notaHistorial,
            metadata: metadataHistorial,
            usuarioId: ctx.usuarioId,
            crearVisita: crearVisita ?? undefined,
            cerrarVisita: cerrarVisita ?? undefined,
            crearCalificacion: crearCalificacion ?? undefined,
            cancelarVisitasProgramadas: reinicioPorCambioTipo || undefined,
          }
        : undefined,
    );

    // Fire-and-forget: un evento de Conversions API que falla o tarda nunca
    // debe frenar ni fallar el cambio de estado real en el CRM.
    if (huboCambioDeEstado) {
      void this.enviarEventoCapi
        .execute(organizacionId, leadId, estadoGestionFinal, historialId)
        .catch(() => undefined);
    }
  }
}
