import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ActualizarOrganizacionAdminInput,
  CrearOrganizacionInput,
  OrganizacionesAdminRepository,
} from '../application/ports/organizaciones-admin.repository.port';

// Módulos que quedan encendidos por defecto al crear una organización — PLAN.md §4.5/§5.1.
const MODULOS_ENCENDIDOS_POR_DEFECTO = ['META_LEADS', 'DASHBOARD'];

@Injectable()
export class PrismaOrganizacionesAdminRepository implements OrganizacionesAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.organizacion.findMany({ orderBy: { fechaCreacion: 'desc' } });
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
