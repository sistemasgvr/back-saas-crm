import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';

export interface RegistrarSuscripcionPushInput {
  organizacionId: string;
  usuarioId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

@Injectable()
export class RegistrarSuscripcionPushUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: RegistrarSuscripcionPushInput): Promise<{ id: string }> {
    const existente = await this.prisma.suscripcionPush.findUnique({
      where: { endpoint: input.endpoint },
    });

    if (existente) {
      const actualizada = await this.prisma.suscripcionPush.update({
        where: { id: existente.id },
        data: {
          usuarioId: input.usuarioId,
          organizacionId: input.organizacionId,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent?.slice(0, 255) ?? null,
          estado: 1,
          usuarioEdicion: input.usuarioId,
        },
      });
      return { id: actualizada.id };
    }

    const creada = await this.prisma.suscripcionPush.create({
      data: {
        usuarioId: input.usuarioId,
        organizacionId: input.organizacionId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
        usuarioCreacion: input.usuarioId,
      },
    });
    return { id: creada.id };
  }
}
