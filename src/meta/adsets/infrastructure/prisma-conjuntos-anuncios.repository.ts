import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  ConjuntoAnuncioFiltro,
  ConjuntosAnunciosRepository,
} from '../application/ports/conjuntos-anuncios.repository.port';

@Injectable()
export class PrismaConjuntosAnunciosRepository implements ConjuntosAnunciosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorOrganizacion(
    organizacionId: string,
    campanaId?: string,
  ): Promise<ConjuntoAnuncioFiltro[]> {
    const conjuntos = await this.prisma.conjuntoAnuncio.findMany({
      where: { organizacionId, estado: 1, ...(campanaId ? { campanaId } : {}) },
      orderBy: { nombre: 'asc' },
    });
    return conjuntos.map((c) => ({
      id: c.id,
      campanaId: c.campanaId,
      nombre: c.nombre,
      estadoMeta: c.estadoMeta,
    }));
  }
}
