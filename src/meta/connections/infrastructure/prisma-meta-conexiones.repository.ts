import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type {
  ActualizarTokenInput,
  GuardarCredencialesInput,
  MetaConexionesRepository,
} from '../application/ports/meta-conexiones.repository.port';

@Injectable()
export class PrismaMetaConexionesRepository implements MetaConexionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActivaPorOrganizacion(organizacionId: string) {
    return this.prisma.metaConexion.findFirst({
      where: { organizacionId, estado: 1 },
    });
  }

  findActivaPorPageId(pageId: string) {
    return this.prisma.metaConexion.findFirst({ where: { pageId, estado: 1 } });
  }

  findActivaPorWebhookVerifyToken(token: string) {
    return this.prisma.metaConexion.findFirst({
      where: { webhookVerifyToken: token, estado: 1 },
    });
  }

  listActivasConAppSecret() {
    return this.prisma.metaConexion.findMany({
      where: { estado: 1, appSecretCifrado: { not: null } },
    });
  }

  async guardarCredencialesApp(input: GuardarCredencialesInput) {
    const existente = await this.findActivaPorOrganizacion(
      input.organizacionId,
    );

    if (existente) {
      return this.prisma.metaConexion.update({
        where: { id: existente.id },
        data: {
          appId: input.appId,
          appSecretCifrado: input.appSecretCifrado,
          usuarioEdicion: input.usuarioEdicion,
        },
      });
    }

    return this.prisma.metaConexion.create({
      data: {
        organizacionId: input.organizacionId,
        appId: input.appId,
        appSecretCifrado: input.appSecretCifrado,
        webhookVerifyToken: randomBytes(32).toString('hex'),
        usuarioCreacion: input.usuarioEdicion,
      },
    });
  }

  async actualizarTokenOAuth(input: ActualizarTokenInput) {
    const existente = await this.findActivaPorOrganizacion(
      input.organizacionId,
    );
    if (!existente) {
      throw new NotFoundException(
        'No hay credenciales de Meta App guardadas para esta organización',
      );
    }
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

  async limpiarConexionOAuth(
    id: string,
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.metaConexion.update({
      where: { id },
      data: {
        metaUserId: null,
        metaUserNombre: null,
        tokenCifrado: null,
        tokenExpiraEn: null,
        scopes: null,
        pageId: null,
        pageNombre: null,
        adAccountId: null,
        adAccountNombre: null,
        usuarioEdicion,
      },
    });
  }

  async actualizarFeaturesDeseadas(
    id: string,
    featuresDeseadas: string[],
    usuarioEdicion: string,
  ): Promise<void> {
    await this.prisma.metaConexion.update({
      where: { id },
      data: { featuresDeseadas, usuarioEdicion },
    });
  }
}
