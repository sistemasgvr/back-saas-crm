import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { RolOrganizacion } from '../domain/request-context.interface';
import {
  MembresiaActiva,
  OrganizacionUsuariosRepository,
} from '../application/ports/organizacion-usuarios.repository.port';

@Injectable()
export class PrismaOrganizacionUsuariosRepository implements OrganizacionUsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMembresiasActivas(usuarioId: string): Promise<MembresiaActiva[]> {
    const filas = await this.prisma.organizacionUsuario.findMany({
      where: { usuarioId, estado: 1, organizacion: { estado: 1 } },
      include: { organizacion: true },
      orderBy: { fechaCreacion: 'asc' },
    });

    return filas.map((fila) => ({
      organizacionId: fila.organizacionId,
      organizacionNombre: fila.organizacion.nombre,
      organizacionSlug: fila.organizacion.slug,
      rol: fila.rol as RolOrganizacion,
    }));
  }

  async findMembresiaActiva(
    usuarioId: string,
    organizacionId: string,
  ): Promise<MembresiaActiva | null> {
    const fila = await this.prisma.organizacionUsuario.findFirst({
      where: {
        usuarioId,
        organizacionId,
        estado: 1,
        organizacion: { estado: 1 },
      },
      include: { organizacion: true },
    });

    if (!fila) return null;

    return {
      organizacionId: fila.organizacionId,
      organizacionNombre: fila.organizacion.nombre,
      organizacionSlug: fila.organizacion.slug,
      rol: fila.rol as RolOrganizacion,
    };
  }
}
