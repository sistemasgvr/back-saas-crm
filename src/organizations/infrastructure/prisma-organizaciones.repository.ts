import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ActualizarOrganizacionInput,
  OrganizacionesRepository,
} from '../application/ports/organizaciones.repository.port';

@Injectable()
export class PrismaOrganizacionesRepository implements OrganizacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActivaById(id: string) {
    return this.prisma.organizacion.findFirst({ where: { id, estado: 1 } });
  }

  actualizar(
    id: string,
    data: ActualizarOrganizacionInput,
    usuarioEdicion: string,
  ) {
    return this.prisma.organizacion.update({
      where: { id },
      data: { ...data, usuarioEdicion },
    });
  }

  async obtenerPipelineConfig(organizacionId: string) {
    const row = await this.prisma.organizacion.findFirst({
      where: { id: organizacionId, estado: 1 },
      select: { pipelineConfig: true },
    });
    return row?.pipelineConfig ?? null;
  }

  async actualizarPipelineConfig(
    organizacionId: string,
    config: Prisma.InputJsonValue | null,
    usuarioEdicion: string,
  ) {
    await this.prisma.organizacion.update({
      where: { id: organizacionId },
      data: {
        pipelineConfig: config === null ? Prisma.DbNull : config,
        usuarioEdicion,
      },
    });
  }
}
