import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type { CampanaFiltro, CampanasRepository } from '../application/ports/campanas.repository.port';

@Injectable()
export class PrismaCampanasRepository implements CampanasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorOrganizacion(organizacionId: string): Promise<CampanaFiltro[]> {
    const campanas = await this.prisma.campana.findMany({
      where: { organizacionId, estado: 1 },
      orderBy: { nombre: 'asc' },
    });
    return campanas.map((c) => ({ id: c.id, nombre: c.nombre, estadoMeta: c.estadoMeta }));
  }
}
