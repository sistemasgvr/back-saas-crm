import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  PushNotificationPayload,
  PushSender,
} from '../application/ports/push-sender.port';

@Injectable()
export class WebPushSender implements PushSender, OnModuleInit {
  private readonly logger = new Logger(WebPushSender.name);
  private ready = false;
  private vapidPublic: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY')?.trim();
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY')?.trim();
    const subject =
      this.config.get<string>('VAPID_SUBJECT')?.trim() ||
      'mailto:sistemas@proyectosgvr.com';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas — Web Push deshabilitado',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidPublic = publicKey;
    this.ready = true;
    this.logger.log('Web Push habilitado (VAPID)');
  }

  habilitado(): boolean {
    return this.ready;
  }

  publicKey(): string | null {
    return this.vapidPublic;
  }

  async enviarAUsuarios(
    usuarioIds: string[],
    data: PushNotificationPayload,
    organizacionId?: string,
  ): Promise<void> {
    if (!this.ready || usuarioIds.length === 0) return;

    const subs = await this.prisma.suscripcionPush.findMany({
      where: {
        usuarioId: { in: usuarioIds },
        estado: 1,
        ...(organizacionId ? { organizacionId } : {}),
      },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify({
      id: data.id,
      tipo: data.tipo,
      titulo: data.titulo,
      mensaje: data.mensaje,
      payload: data.payload ?? null,
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
            { TTL: 60 * 60 },
          );
        } catch (err: unknown) {
          const status =
            err && typeof err === 'object' && 'statusCode' in err
              ? Number((err as { statusCode: number }).statusCode)
              : 0;
          if (status === 404 || status === 410) {
            await this.prisma.suscripcionPush
              .update({ where: { id: sub.id }, data: { estado: 0 } })
              .catch(() => undefined);
            return;
          }
          this.logger.warn(
            `Push falló para suscripción ${sub.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );
  }
}
