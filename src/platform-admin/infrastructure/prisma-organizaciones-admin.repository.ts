import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { construirResultadoPaginado } from '../../shared/application/paginacion';
import type {
  ActualizarOrganizacionAdminInput,
  CrearOrganizacionInput,
  FiltroListadoOrganizaciones,
  OrganizacionesAdminRepository,
} from '../application/ports/organizaciones-admin.repository.port';

// Módulos que quedan encendidos por defecto al crear una organización — PLAN.md §4.5/§5.1.
const MODULOS_ENCENDIDOS_POR_DEFECTO = ['META_LEADS', 'DASHBOARD'];

@Injectable()
export class PrismaOrganizacionesAdminRepository implements OrganizacionesAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroListadoOrganizaciones) {
    const q = filtro.q?.trim();
    const where: Prisma.OrganizacionWhereInput = {
      ...(filtro.estado !== undefined ? { estado: filtro.estado } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { razonSocial: { contains: q, mode: 'insensitive' } },
              { emailContacto: { contains: q, mode: 'insensitive' } },
              { documentoFiscal: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, organizaciones] = await Promise.all([
      this.prisma.organizacion.count({ where }),
      this.prisma.organizacion.findMany({
        where,
        orderBy: { fechaCreacion: 'desc' },
        skip: (filtro.page - 1) * filtro.pageSize,
        take: filtro.pageSize,
      }),
    ]);
    return construirResultadoPaginado(organizaciones, total, filtro.page, filtro.pageSize);
  }

  obtenerPorId(id: string) {
    return this.prisma.organizacion.findUnique({ where: { id } });
  }

  crearConModulosPorDefecto(input: CrearOrganizacionInput, usuarioCreacion: string) {
    return this.prisma.$transaction(async (tx) => {
      const organizacion = await tx.organizacion.create({ data: { ...input, usuarioCreacion } });
      const catalogo = await tx.modulo.findMany({ where: { estado: 1 } });

      await tx.organizacionModulo.createMany({
        data: catalogo.map((modulo) => {
          const habilitado = MODULOS_ENCENDIDOS_POR_DEFECTO.includes(modulo.codigo);
          return {
            organizacionId: organizacion.id,
            moduloId: modulo.id,
            habilitado: habilitado ? 1 : 0,
            fechaActivacion: habilitado ? new Date() : null,
            usuarioCreacion,
          };
        }),
      });

      return organizacion;
    });
  }

  actualizar(id: string, data: ActualizarOrganizacionAdminInput, usuarioEdicion: string) {
    return this.prisma.organizacion.update({ where: { id }, data: { ...data, usuarioEdicion } });
  }

  desactivar(id: string, usuarioEdicion: string) {
    return this.prisma.organizacion.update({
      where: { id },
      data: { estado: 0, usuarioEdicion },
    });
  }
}
