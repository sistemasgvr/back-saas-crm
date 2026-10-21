import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import {
  CrearTokenRefrescoInput,
  TokensRefrescoRepository,
} from '../application/ports/tokens-refresco.repository.port';

@Injectable()
export class PrismaTokensRefrescoRepository implements TokensRefrescoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(input: CrearTokenRefrescoInput): Promise<void> {
    await this.prisma.tokenRefresco.create({
      data: {
        usuarioId: input.usuarioId,
        familiaId: input.familiaId,
        tokenHash: input.tokenHash,
        expiraEn: input.expiraEn,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  }

  findVigentePorHash(tokenHash: string) {
    return this.prisma.tokenRefresco.findFirst({
      where: {
        tokenHash,
        estado: 1,
        revocadoEn: null,
        expiraEn: { gt: new Date() },
      },
    });
  }

  findRevocadoRecientePorHash(tokenHash: string, graciaMs: number) {
    const desde = new Date(Date.now() - graciaMs);
    return this.prisma.tokenRefresco.findFirst({
      where: {
        tokenHash,
        revocadoEn: { gte: desde },
        estado: 1,
        expiraEn: { gt: new Date() },
      },
      orderBy: { revocadoEn: 'desc' },
    });
  }

  async revocar(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const initial = await tx.tokenRefresco.findUnique({ where: { id } });
      if (!initial) return;
      const familia = initial.familiaId ?? initial.id;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`refresh:${familia}`}, 0))::text`;
      await tx.tokenRefresco.updateMany({
        where: { OR: [{ id }, { familiaId: familia }] },
        data: { revocadoEn: new Date(), estado: 0 },
      });
    });
  }

  async rotar(
    id: string,
    nuevo: CrearTokenRefrescoInput,
    graciaMs: number,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const familia = nuevo.familiaId!;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`refresh:${familia}`}, 0))::text`;
      const actual = await tx.tokenRefresco.findUnique({ where: { id } });
      const now = new Date();
      if (
        !actual ||
        actual.estado !== 1 ||
        actual.expiraEn <= now ||
        (actual.revocadoEn &&
          actual.revocadoEn.getTime() < now.getTime() - graciaMs)
      )
        return false;
      await tx.tokenRefresco.update({
        where: { id },
        data: {
          familiaId: familia,
          revocadoEn: actual.revocadoEn ?? now,
        },
      });
      await tx.tokenRefresco.create({ data: nuevo });
      return true;
    });
  }
}
