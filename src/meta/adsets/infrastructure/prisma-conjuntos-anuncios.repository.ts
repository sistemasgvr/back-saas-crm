import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  ConjuntoAnuncioFiltro,
  ConjuntosAnunciosRepository,
  UpsertConjuntoAnuncioInput,
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

  async upsertPorMetaId(
    input: UpsertConjuntoAnuncioInput,
  ): Promise<{ id: string }> {
    const conjunto = await this.prisma.conjuntoAnuncio.upsert({
      where: {
        organizacionId_metaConjuntoId: {
          organizacionId: input.organizacionId,
          metaConjuntoId: input.metaConjuntoId,
        },
      },
      update: {
        nombre: input.nombre,
        estadoMeta: input.estadoMeta,
        datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
      },
      create: {
        organizacionId: input.organizacionId,
        campanaId: input.campanaId,
        metaConjuntoId: input.metaConjuntoId,
        nombre: input.nombre,
        estadoMeta: input.estadoMeta,
        datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
      },
    });
    return { id: conjunto.id };
  }
}
