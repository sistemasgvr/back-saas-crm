import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import {
  ModuloOrganizacion,
  ModulosRepository,
} from '../application/ports/modulos.repository.port';

@Injectable()
export class PrismaModulosRepository implements ModulosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findModulosPorOrganizacion(
    organizacionId: string,
  ): Promise<ModuloOrganizacion[]> {
    const filas = await this.prisma.organizacionModulo.findMany({
      where: { organizacionId, estado: 1, modulo: { estado: 1 } },
      include: { modulo: true },
      orderBy: { modulo: { orden: 'asc' } },
    });

    return filas.map((fila) => ({
      codigo: fila.modulo.codigo,
      habilitado: fila.habilitado === 1,
    }));
  }
}
