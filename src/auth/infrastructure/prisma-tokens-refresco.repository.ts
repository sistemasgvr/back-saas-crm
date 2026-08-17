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

  async revocar(id: string): Promise<void> {
    await this.prisma.tokenRefresco.update({
      where: { id },
      data: { revocadoEn: new Date(), estado: 0 },
    });
  }
}
