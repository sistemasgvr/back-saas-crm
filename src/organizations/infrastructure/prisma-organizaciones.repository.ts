import { Injectable } from '@nestjs/common';
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
}
