import { lockBotOrganizacion } from '../../whatsapp/messaging/application/bot-organizacion-lock';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  ModuloConHabilitado,
  OrganizacionModulosAdminRepository,
} from '../application/ports/organizacion-modulos-admin.repository.port';

@Injectable()
export class PrismaOrganizacionModulosAdminRepository implements OrganizacionModulosAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarMatrizPorOrganizacion(
    organizacionId: string,
  ): Promise<ModuloConHabilitado[]> {
    const [catalogo, relaciones] = await Promise.all([
      this.prisma.modulo.findMany({
        where: { estado: 1 },
        orderBy: { orden: 'asc' },
      }),
      this.prisma.organizacionModulo.findMany({
        where: { organizacionId, estado: 1 },
      }),
    ]);

    const porModuloId = new Map(
      relaciones.map((relacion) => [relacion.moduloId, relacion]),
    );

    return catalogo.map((modulo) => ({
      id: modulo.id,
      codigo: modulo.codigo,
      nombre: modulo.nombre,
      descripcion: modulo.descripcion,
      icono: modulo.icono,
      orden: modulo.orden,
      habilitado: porModuloId.get(modulo.id)?.habilitado === 1,
    }));
  }

  async toggle(
    organizacionId: string,
    moduloId: string,
    habilitado: boolean,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockBotOrganizacion(tx, organizacionId);
      const existente = await tx.organizacionModulo.findUnique({
        where: { organizacionId_moduloId: { organizacionId, moduloId } },
      });
      const cambio =
        !existente ||
        existente.habilitado !== (habilitado ? 1 : 0) ||
        existente.estado !== 1;
      await tx.organizacionModulo.upsert({
        where: { organizacionId_moduloId: { organizacionId, moduloId } },
        create: {
          organizacionId,
          moduloId,
          habilitado: habilitado ? 1 : 0,
          fechaActivacion: habilitado ? new Date() : null,
          usuarioCreacion: usuarioEdicion,
        },
        update: {
          estado: 1,
          habilitado: habilitado ? 1 : 0,
          usuarioEdicion,
          fechaActivacion:
            habilitado && existente?.habilitado !== 1
              ? new Date()
              : existente?.fechaActivacion,
        },
      });
      const modulo = await tx.modulo.findUnique({ where: { id: moduloId } });
      if (
        cambio &&
        ['WHATSAPP', 'AUTOMATIZACIONES'].includes(modulo?.codigo ?? '')
      ) {
        await tx.whatsappBotConfiguracion.updateMany({
          where: { organizacionId },
          data: { version: { increment: 1 } },
        });
      }
    });
  }
}
