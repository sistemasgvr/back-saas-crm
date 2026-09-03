import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';

@Injectable()
export class EliminarSuscripcionPushUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(usuarioId: string, endpoint: string): Promise<void> {
    await this.prisma.suscripcionPush.updateMany({
      where: { usuarioId, endpoint },
      data: { estado: 0, usuarioEdicion: usuarioId },
    });
  }
}
