import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type { AnuncioFiltro, AnunciosRepository } from '../application/ports/anuncios.repository.port';

@Injectable()
export class PrismaAnunciosRepository implements AnunciosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorOrganizacion(
    organizacionId: string,
    conjuntoAnuncioId?: string,
  ): Promise<AnuncioFiltro[]> {
    const anuncios = await this.prisma.anuncio.findMany({
      where: { organizacionId, estado: 1, ...(conjuntoAnuncioId ? { conjuntoAnuncioId } : {}) },
      orderBy: { nombre: 'asc' },
    });
    return anuncios.map((a) => ({
      id: a.id,
      conjuntoAnuncioId: a.conjuntoAnuncioId,
      nombre: a.nombre,
      estadoMeta: a.estadoMeta,
    }));
  }
}
