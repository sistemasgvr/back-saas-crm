import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  MetaConexionesRepository,
  UpsertConexionInput,
} from '../application/ports/meta-conexiones.repository.port';

@Injectable()
export class PrismaMetaConexionesRepository implements MetaConexionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActivaPorOrganizacion(organizacionId: string) {
    return this.prisma.metaConexion.findFirst({ where: { organizacionId, estado: 1 } });
  }

  findActivaPorPageId(pageId: string) {
    return this.prisma.metaConexion.findFirst({ where: { pageId, estado: 1 } });
  }

  async upsertPorOrganizacion(input: UpsertConexionInput) {
    const existente = await this.findActivaPorOrganizacion(input.organizacionId);

    if (existente) {
      return this.prisma.metaConexion.update({
        where: { id: existente.id },
        data: {
          metaUserId: input.metaUserId,
          metaUserNombre: input.metaUserNombre,
          tokenCifrado: input.tokenCifrado,
          tokenExpiraEn: input.tokenExpiraEn,
          scopes: input.scopes,
          usuarioEdicion: input.usuarioEdicion,
        },
      });
    }

    return this.prisma.metaConexion.create({
      data: {
        organizacionId: input.organizacionId,
        metaUserId: input.metaUserId,
        metaUserNombre: input.metaUserNombre,
        tokenCifrado: input.tokenCifrado,
        tokenExpiraEn: input.tokenExpiraEn,
        scopes: input.scopes,
        webhookVerifyToken: randomBytes(32).toString('hex'),
        usuarioCreacion: input.usuarioEdicion,
      },
    });
  }

  actualizarPagina(id: string, pageId: string, pageNombre: string, usuarioEdicion: string) {
    return this.prisma.metaConexion.update({
      where: { id },
      data: { pageId, pageNombre, usuarioEdicion },
    });
  }

  actualizarCuentaPublicitaria(
    id: string,
    adAccountId: string,
    adAccountNombre: string,
    usuarioEdicion: string,
  ) {
    return this.prisma.metaConexion.update({
      where: { id },
      data: { adAccountId, adAccountNombre, usuarioEdicion },
    });
  }

  async desactivar(id: string, usuarioEdicion: string): Promise<void> {
    await this.prisma.metaConexion.update({
      where: { id },
      data: { estado: 0, usuarioEdicion },
    });
  }
}
