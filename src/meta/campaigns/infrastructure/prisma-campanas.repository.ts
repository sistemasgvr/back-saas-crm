import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  CampanaFiltro,
  CampanasRepository,
  UpsertCampanaInput,
} from '../application/ports/campanas.repository.port';

@Injectable()
export class PrismaCampanasRepository implements CampanasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorOrganizacion(
    organizacionId: string,
  ): Promise<CampanaFiltro[]> {
    const campanas = await this.prisma.campana.findMany({
      where: { organizacionId, estado: 1 },
      orderBy: { nombre: 'asc' },
    });
    return campanas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      estadoMeta: c.estadoMeta,
    }));
  }

  async upsertPorMetaId(input: UpsertCampanaInput): Promise<{ id: string }> {
    // update con los mismos campos que create — así el sync manual (Fase 13.3) y el
    // reprocesamiento del webhook refrescan nombre/estado/cuenta en vez de dejar la
    // fila congelada en su primer valor. metaCuentaPublicitariaId undefined = Prisma
    // no toca el valor existente (no lo pisa con NULL) cuando el webhook no lo trae.
    const campana = await this.prisma.campana.upsert({
      where: {
        organizacionId_metaCampanaId: {
          organizacionId: input.organizacionId,
          metaCampanaId: input.metaCampanaId,
        },
      },
      update: {
        nombre: input.nombre,
        estadoMeta: input.estadoMeta,
        datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
        metaCuentaPublicitariaId: input.metaCuentaPublicitariaId,
      },
      create: {
        organizacionId: input.organizacionId,
        metaCampanaId: input.metaCampanaId,
        nombre: input.nombre,
        estadoMeta: input.estadoMeta,
        datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
        metaCuentaPublicitariaId: input.metaCuentaPublicitariaId,
      },
    });
    return { id: campana.id };
  }
}
