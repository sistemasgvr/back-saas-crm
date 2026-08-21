import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  FiltroAsignacion,
  FiltroLeads,
  LeadDetalle,
  LeadResumen,
  LeadsLecturaRepository,
  ListaLeadsResultado,
  ReferenciaNombrada,
} from '../application/ports/leads-lectura.repository.port';

type LeadConRelaciones = Prisma.LeadGetPayload<{
  include: {
    campana: true;
    anuncio: true;
    conjuntoAnuncio: true;
    asignadoUsuario: true;
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
  };
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
      },
    });
    if (!lead) return null;

    return {
      ...toResumen(lead),
      conjuntoAnuncio: refOpcional(lead.conjuntoAnuncio),
      formularioId: lead.formularioId,
      idExterno: lead.idExterno,
      datosCrudos: lead.datosCrudos,
      fechaCreacion: lead.fechaCreacion,
    };
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
}
