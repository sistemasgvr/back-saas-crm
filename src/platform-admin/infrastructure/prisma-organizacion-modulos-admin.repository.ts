import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ModuloConHabilitado,
  OrganizacionModulosAdminRepository,
} from '../application/ports/organizacion-modulos-admin.repository.port';

@Injectable()
export class PrismaOrganizacionModulosAdminRepository implements OrganizacionModulosAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarMatrizPorOrganizacion(organizacionId: string): Promise<ModuloConHabilitado[]> {
    const [catalogo, relaciones] = await Promise.all([
      this.prisma.modulo.findMany({ where: { estado: 1 }, orderBy: { orden: 'asc' } }),
      this.prisma.organizacionModulo.findMany({ where: { organizacionId, estado: 1 } }),
    ]);

    const porModuloId = new Map(relaciones.map((relacion) => [relacion.moduloId, relacion]));

    return catalogo.map((modulo) => ({
      id: modulo.id,
      codigo: modulo.codigo,
      nombre: modulo.nombre,
      icono: modulo.icono,
      orden: modulo.orden,
      habilitado: porModuloId.get(modulo.id)?.habilitado === 1,
    }));
  }

  async toggle(
    organizacionId: string,
    moduloId: string,
    habilitado: boolean,
    usuarioEdicion: string,
  ): Promise<void> {
    const existente = await this.prisma.organizacionModulo.findUnique({
      where: { organizacionId_moduloId: { organizacionId, moduloId } },
    });

    if (!existente) {
      await this.prisma.organizacionModulo.create({
        data: {
          organizacionId,
          moduloId,
          habilitado: habilitado ? 1 : 0,
          fechaActivacion: habilitado ? new Date() : null,
          usuarioCreacion: usuarioEdicion,
        },
      });
      return;
    }

    await this.prisma.organizacionModulo.update({
      where: { id: existente.id },
      data: {
        habilitado: habilitado ? 1 : 0,
        usuarioEdicion,
        fechaActivacion:
          habilitado && existente.habilitado === 0 ? new Date() : existente.fechaActivacion,
      },
    });
  }
}
