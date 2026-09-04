import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { ESTADOS_TERMINALES } from '../../shared/domain/pipeline-inmobiliaria';
import type {
  FiltroAsignacion,
  FiltroLeads,
  InmuebleResumenCorto,
  LeadDetalle,
  LeadResumen,
  LeadsLecturaRepository,
  LeadTableroRow,
  ListaLeadsResultado,
  ReferenciaNombrada,
} from '../application/ports/leads-lectura.repository.port';

/** Tope de seguridad para el tablero — no pagina, así que hace falta un
 * límite duro para no traer miles de filas de una organización con mucho volumen. */
const TOPE_TABLERO = 300;

const INMUEBLE_INTERES_SELECT = {
  id: true,
  codigo: true,
  titulo: true,
} as const;

type LeadConRelaciones = Prisma.LeadGetPayload<{
  include: {
    campana: true;
    anuncio: true;
    conjuntoAnuncio: true;
    asignadoUsuario: true;
    inmuebleInteres: { select: typeof INMUEBLE_INTERES_SELECT };
  };
}>;

function refOpcional(
  ref: { id: string; nombre: string } | null,
): ReferenciaNombrada | null {
  return ref ? { id: ref.id, nombre: ref.nombre } : null;
}

function nombreUsuario(
  usuario: {
    id: string;
    nombre: string;
    apellido: string | null;
  } | null,
): ReferenciaNombrada | null {
  if (!usuario) return null;
  return {
    id: usuario.id,
    nombre: [usuario.nombre, usuario.apellido].filter(Boolean).join(' '),
  };
}

function inmuebleInteresRef(
  inmueble: { id: string; codigo: string; titulo: string } | null,
): InmuebleResumenCorto | null {
  return inmueble
    ? { id: inmueble.id, codigo: inmueble.codigo, titulo: inmueble.titulo }
    : null;
}

function toResumen(lead: LeadConRelaciones): LeadResumen {
  return {
    id: lead.id,
    nombre: lead.nombre,
    email: lead.email,
    telefono: lead.telefono,
    fechaLead: lead.fechaLead,
    campana: refOpcional(lead.campana),
    anuncio: refOpcional(lead.anuncio),
    tipoLead: lead.tipoLead,
    asignado: nombreUsuario(lead.asignadoUsuario),
    estadoGestion: lead.estadoGestion,
    inmuebleInteres: inmuebleInteresRef(lead.inmuebleInteres),
  };
}

function whereDeEstadoGestion(estadoGestion: string): Prisma.LeadWhereInput {
  if (estadoGestion === 'ABIERTOS') {
    return { estadoGestion: { notIn: [...ESTADOS_TERMINALES] } };
  }
  if (estadoGestion === 'CERRADOS') {
    return { estadoGestion: { in: [...ESTADOS_TERMINALES] } };
  }
  return { estadoGestion };
}

function whereDeAsignacion(
  asignacion: FiltroAsignacion,
): Prisma.LeadWhereInput {
  switch (asignacion.modo) {
    case 'todos':
      return {};
    case 'sin_asignar':
      return { asignadoUsuarioId: null };
    case 'usuario':
      return { asignadoUsuarioId: asignacion.usuarioId };
    case 'mios_y_pool':
      return {
        OR: [
          { asignadoUsuarioId: asignacion.usuarioId },
          { asignadoUsuarioId: null },
        ],
      };
  }
}

@Injectable()
export class PrismaLeadsLecturaRepository implements LeadsLecturaRepository {
  constructor(private readonly prisma: PrismaService) {}

  private construirWhere(
    organizacionId: string,
    filtro: FiltroLeads,
  ): Prisma.LeadWhereInput {
    return {
      organizacionId,
      estado: 1,
      ...(filtro.campanaId ? { campanaId: filtro.campanaId } : {}),
      ...(filtro.anuncioId ? { anuncioId: filtro.anuncioId } : {}),
      ...(filtro.metaPaginaId ? { metaPaginaId: filtro.metaPaginaId } : {}),
      ...(filtro.metaCuentaId
        ? { campana: { metaCuentaPublicitariaId: filtro.metaCuentaId } }
        : {}),
      ...(filtro.formularioId ? { formularioId: filtro.formularioId } : {}),
      ...(filtro.tipoLead ? { tipoLead: filtro.tipoLead } : {}),
      ...(filtro.estadoGestion
        ? whereDeEstadoGestion(filtro.estadoGestion)
        : {}),
      ...(filtro.fechaDesde || filtro.fechaHasta
        ? {
            fechaLead: {
              ...(filtro.fechaDesde ? { gte: filtro.fechaDesde } : {}),
              ...(filtro.fechaHasta ? { lte: filtro.fechaHasta } : {}),
            },
          }
        : {}),
      // AND explícito: el where de asignación también puede traer su propio
      // OR (mios_y_pool) y no debe pisar el OR de la búsqueda por texto.
      AND: [
        whereDeAsignacion(filtro.asignacion),
        ...(filtro.q
          ? [
              {
                OR: [
                  {
                    nombre: {
                      contains: filtro.q,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: { contains: filtro.q, mode: 'insensitive' as const },
                  },
                  {
                    telefono: {
                      contains: filtro.q,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
  }

  async listar(
    organizacionId: string,
    filtro: FiltroLeads,
  ): Promise<ListaLeadsResultado> {
    const where = this.construirWhere(organizacionId, filtro);

    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: {
          campana: true,
          anuncio: true,
          conjuntoAnuncio: true,
          asignadoUsuario: true,
          inmuebleInteres: { select: INMUEBLE_INTERES_SELECT },
        },
        orderBy: [{ fechaLead: 'desc' }, { id: 'desc' }],
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
    ]);

    return {
      data: leads.map(toResumen),
      total,
      page: filtro.page,
      pageSize: filtro.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filtro.pageSize)),
    };
  }

  async obtenerPorId(
    organizacionId: string,
    id: string,
  ): Promise<LeadDetalle | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizacionId, estado: 1 },
      include: {
        campana: true,
        anuncio: true,
        conjuntoAnuncio: true,
        asignadoUsuario: true,
        inmuebleInteres: { select: INMUEBLE_INTERES_SELECT },
      },
    });
    if (!lead) return null;

    const proximaAccion = await this.obtenerProximaAccion(organizacionId, id);

    return {
      ...toResumen(lead),
      conjuntoAnuncio: refOpcional(lead.conjuntoAnuncio),
      formularioId: lead.formularioId,
      idExterno: lead.idExterno,
      datosCrudos: lead.datosCrudos,
      fechaCreacion: lead.fechaCreacion,
      estadoGestionEn: lead.estadoGestionEn,
      motivoCierre: lead.motivoCierre,
      notaCierre: lead.notaCierre,
      proximaAccion,
    };
  }

  private async obtenerProximaAccion(
    organizacionId: string,
    leadId: string,
  ): Promise<LeadDetalle['proximaAccion']> {
    const [visita, actividad] = await Promise.all([
      this.prisma.leadVisita.findFirst({
        where: { organizacionId, leadId, estado: 'PROGRAMADA' },
        orderBy: { programadaEn: 'asc' },
        select: {
          id: true,
          programadaEn: true,
          programadaFin: true,
          referenciaInmueble: true,
        },
      }),
      this.prisma.leadActividad.findFirst({
        where: { organizacionId, leadId, estado: 'PROGRAMADA' },
        orderBy: { programadaEn: 'asc' },
        select: {
          id: true,
          tipo: true,
          titulo: true,
          programadaEn: true,
          programadaFin: true,
        },
      }),
    ]);

    type Candidato = NonNullable<LeadDetalle['proximaAccion']>;
    const candidatos: Candidato[] = [];
    if (visita) {
      candidatos.push({
        origen: 'visita',
        id: visita.id,
        tipo: 'VISITA',
        titulo: visita.referenciaInmueble,
        programadaEn: visita.programadaEn,
        programadaFin: visita.programadaFin,
      });
    }
    if (actividad) {
      candidatos.push({
        origen: 'actividad',
        id: actividad.id,
        tipo: actividad.tipo,
        titulo: actividad.titulo,
        programadaEn: actividad.programadaEn,
        programadaFin: actividad.programadaFin,
      });
    }
    if (candidatos.length === 0) return null;
    candidatos.sort(
      (a, b) => a.programadaEn.getTime() - b.programadaEn.getTime(),
    );
    return candidatos[0] ?? null;
  }

  async listarMiembrosAsignables(
    organizacionId: string,
  ): Promise<ReferenciaNombrada[]> {
    const miembros = await this.prisma.organizacionUsuario.findMany({
      where: { organizacionId, estado: 1, usuario: { estado: 1 } },
      include: { usuario: true },
      orderBy: { usuario: { nombre: 'asc' } },
    });
    return miembros
      .map((m) => nombreUsuario(m.usuario))
      .filter((ref): ref is ReferenciaNombrada => ref !== null);
  }

  async listarParaTablero(
    organizacionId: string,
    filtro: { tipoLead?: string; asignacion: FiltroAsignacion },
  ): Promise<LeadTableroRow[]> {
    const whereTipo: Prisma.LeadWhereInput =
      filtro.tipoLead === undefined
        ? {}
        : filtro.tipoLead === 'OTRO'
          ? { OR: [{ tipoLead: 'OTRO' }, { tipoLead: null }] }
          : { tipoLead: filtro.tipoLead };

    const leads = await this.prisma.lead.findMany({
      where: {
        organizacionId,
        estado: 1,
        ...whereTipo,
        AND: [whereDeAsignacion(filtro.asignacion)],
      },
      include: {
        asignadoUsuario: true,
        inmuebleInteres: { select: INMUEBLE_INTERES_SELECT },
      },
      orderBy: { fechaLead: 'desc' },
      take: TOPE_TABLERO,
    });

    return leads.map((lead) => ({
      id: lead.id,
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      tipoLead: lead.tipoLead,
      asignado: nombreUsuario(lead.asignadoUsuario),
      estadoGestion: lead.estadoGestion,
      fechaLead: lead.fechaLead,
      inmuebleInteres: inmuebleInteresRef(lead.inmuebleInteres),
    }));
  }

  async contarNuevos(
    organizacionId: string,
    asignacion: FiltroAsignacion,
  ): Promise<number> {
    return this.prisma.lead.count({
      where: {
        organizacionId,
        estado: 1,
        estadoGestion: 'NUEVO',
        AND: [whereDeAsignacion(asignacion)],
      },
    });
  }
}
