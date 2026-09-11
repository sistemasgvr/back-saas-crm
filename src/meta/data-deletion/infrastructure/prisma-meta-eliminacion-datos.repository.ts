import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  CrearSolicitudEliminacionInput,
  MetaEliminacionDatosRepository,
  MetaSolicitudEliminacionRow,
} from '../application/ports/meta-eliminacion-datos.repository.port';

@Injectable()
export class PrismaMetaEliminacionDatosRepository
  implements MetaEliminacionDatosRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async crear(
    input: CrearSolicitudEliminacionInput,
  ): Promise<MetaSolicitudEliminacionRow> {
    const row = await this.prisma.metaSolicitudEliminacionDatos.create({
      data: {
        confirmationCode: input.confirmationCode,
        metaUserId: input.metaUserId,
        organizacionId: input.organizacionId,
        metaConexionId: input.metaConexionId,
        tipo: input.tipo,
        estado: input.estado,
        detalle: input.detalle,
        fechaProcesada: new Date(),
      },
    });
    return row;
  }

  findPorConfirmationCode(
    code: string,
  ): Promise<MetaSolicitudEliminacionRow | null> {
    return this.prisma.metaSolicitudEliminacionDatos.findUnique({
      where: { confirmationCode: code },
    });
  }
}
