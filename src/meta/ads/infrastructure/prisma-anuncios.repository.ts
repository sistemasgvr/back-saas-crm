import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  AnuncioFiltro,
  AnunciosRepository,
  UpsertAnuncioInput,
} from '../application/ports/anuncios.repository.port';

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

  async upsertPorMetaId(input: UpsertAnuncioInput): Promise<{ id: string }> {
    const anuncio = await this.prisma.anuncio.upsert({
      where: {
        organizacionId_metaAnuncioId: {
          organizacionId: input.organizacionId,
          metaAnuncioId: input.metaAnuncioId,
        },
      },
      update: {},
      create: {
        organizacionId: input.organizacionId,
        conjuntoAnuncioId: input.conjuntoAnuncioId,
        metaAnuncioId: input.metaAnuncioId,
        nombre: input.nombre,
        estadoMeta: input.estadoMeta,
        datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
      },
    });
    return { id: anuncio.id };
  }
}
