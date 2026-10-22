import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import type {
  PushNotificationPayload,
  PushSendResult,
  PushSender,
} from '../application/ports/push-sender.port';

/** Esperas entre reintentos ante fallas transitorias del servicio de push. */
const ESPERAS_REINTENTO_MS = [2_000, 10_000, 30_000];
const ESPERA_MAXIMA_MS = 60_000;

/** Tipos que el usuario espera al instante: el servicio de push (FCM, APNs,
 * Mozilla) los entrega aunque el teléfono esté en ahorro de batería. */
const TIPOS_URGENTES = new Set([
  'WHATSAPP_MENSAJE',
  'LEAD_NUEVO',
  'LEAD_ASIGNADO',
  'AGENDA_PROXIMA',
]);

/** Vigencia en el servicio de push si el dispositivo está desconectado. */
const TTL_POR_TIPO_S: Record<string, number> = {
  WHATSAPP_MENSAJE: 12 * 60 * 60,
  AGENDA_PROXIMA: 60 * 60,
};
const TTL_DEFECTO_S = 24 * 60 * 60;

type ResultadoEnvio = 'entregado' | 'baja' | 'fallido';

function statusDe(err: unknown): number {
  return err && typeof err === 'object' && 'statusCode' in err
    ? Number((err as { statusCode: number }).statusCode) || 0
    : 0;
}

/** Retry-After (segundos) que manda el servicio de push en 429/503. */
function retryAfterMs(err: unknown): number | null {
  const headers =
    err && typeof err === 'object' && 'headers' in err
      ? (err as { headers?: Record<string, string | undefined> }).headers
      : undefined;
  const valor = Number(headers?.['retry-after']);
  return Number.isFinite(valor) && valor > 0 ? valor * 1000 : null;
}

/** Sin status = red/timeout; 429 = rate limit; 5xx = caída del servicio. */
function esTransitorio(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

const esperar = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });

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
    _organizacionId?: string,
  ): Promise<PushSendResult> {
    const vacio: PushSendResult = { attempted: 0, delivered: 0, failed: 0 };
    if (!this.ready || usuarioIds.length === 0) return vacio;

    // Sin filtrar por organizacionId: el endpoint es por dispositivo/usuario;
    // si el usuario cambió de org, la fila puede tener otra organizacionId.
    const subs = await this.prisma.suscripcionPush.findMany({
      where: {
        usuarioId: { in: usuarioIds },
        estado: 1,
      },
    });
    if (subs.length === 0) return vacio;

    const body = JSON.stringify({
      id: data.id,
      tipo: data.tipo,
      titulo: data.titulo,
      mensaje: data.mensaje,
      payload: data.payload ?? null,
    });
    const opciones = this.opcionesPara(data);

    const resultados = await Promise.all(
      subs.map((sub) => this.enviarConReintentos(sub, body, opciones)),
    );
    const delivered = resultados.filter((r) => r === 'entregado').length;
    const failed = resultados.length - delivered;
    if (failed > 0) {
      this.logger.warn(
        `Push ${data.tipo} (${data.id}): ${delivered}/${subs.length} dispositivos; ${resultados.filter((r) => r === 'baja').length} suscripciones vencidas dadas de baja`,
      );
    }
    return { attempted: subs.length, delivered, failed };
  }

  /** urgency alta para lo que el usuario espera al instante; topic por chat
   * para que el servicio reemplace avisos pendientes del mismo chat si el
   * teléfono estaba desconectado (llega solo el último, con el conteo). */
  private opcionesPara(data: PushNotificationPayload): webpush.RequestOptions {
    const conversacionId = data.payload?.whatsappConversacionId;
    const topic =
      typeof conversacionId === 'string'
        ? conversacionId.replace(/-/g, '').slice(0, 32)
        : undefined;
    return {
      TTL: TTL_POR_TIPO_S[data.tipo] ?? TTL_DEFECTO_S,
      urgency: TIPOS_URGENTES.has(data.tipo) ? 'high' : 'normal',
      timeout: 10_000,
      ...(topic ? { topic } : {}),
    };
  }

  private async enviarConReintentos(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    body: string,
    opciones: webpush.RequestOptions,
  ): Promise<ResultadoEnvio> {
    for (let intento = 0; ; intento += 1) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          opciones,
        );
        return 'entregado';
      } catch (err: unknown) {
        const status = statusDe(err);
        // Suscripción vencida o de otras credenciales VAPID: no reintentar.
        if ([401, 403, 404, 410].includes(status)) {
          await this.prisma.suscripcionPush
            .update({ where: { id: sub.id }, data: { estado: 0 } })
            .catch(() => undefined);
          return 'baja';
        }
        const espera = ESPERAS_REINTENTO_MS[intento];
        if (esTransitorio(status) && espera !== undefined) {
          await esperar(
            Math.min(
              Math.max(espera, retryAfterMs(err) ?? 0),
              ESPERA_MAXIMA_MS,
            ),
          );
          continue;
        }
        this.logger.warn(
          `Push falló para suscripción ${sub.id} (status ${status || 'red'}, intento ${intento + 1}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return 'fallido';
      }
    }
  }
}
