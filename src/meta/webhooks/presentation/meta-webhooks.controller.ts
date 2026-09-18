import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ProcesarLeadEntranteUseCase } from '../../leads/application/use-cases/procesar-lead-entrante.use-case';
import { PageSinConexionError } from '../../leads/application/errors/page-sin-conexion.error';
import { extraerEventosLeadgen } from '../domain/leadgen-webhook-payload.interface';
import type { LeadgenWebhookPayload } from '../domain/leadgen-webhook-payload.interface';
import { extraerEventosWhatsApp } from '../domain/whatsapp-webhook-payload.interface';
import type { WhatsappWebhookPayload } from '../domain/whatsapp-webhook-payload.interface';
import { VerificarWebhookMetaUseCase } from '../application/use-cases/verificar-webhook-meta.use-case';
import { CrearNotificacionUseCase } from '../../../notifications/application/use-cases/crear-notificacion.use-case';
import { AutoAsignarLeadUseCase } from '../../../leads/application/use-cases/auto-asignar-lead.use-case';
import { ProcesarMensajeWhatsAppEntranteUseCase } from '../../../whatsapp/messaging/application/use-cases/procesar-mensaje-whatsapp-entrante.use-case';
import { ProcesarEcoMensajeWhatsAppUseCase } from '../../../whatsapp/messaging/application/use-cases/procesar-eco-mensaje-whatsapp.use-case';
import { ProcesarEstadoWhatsAppUseCase } from '../../../whatsapp/messaging/application/use-cases/procesar-estado-whatsapp.use-case';
import { ProcesarReaccionWhatsAppUseCase } from '../../../whatsapp/messaging/application/use-cases/procesar-reaccion-whatsapp.use-case';
import { ProcesarEdicionWhatsAppUseCase } from '../../../whatsapp/messaging/application/use-cases/procesar-edicion-whatsapp.use-case';
import { ProcesarLlamadaWebhookUseCase } from '../../../whatsapp/calls/application/use-cases/procesar-llamada-webhook.use-case';

function esErrorReintentable(error: unknown): boolean {
  if (error instanceof PageSinConexionError) return false;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique / not found / constraint: no tiene sentido reintentar el mismo payload.
    if (['P2002', 'P2025', 'P2003'].includes(error.code)) return false;
    return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  // Fallos transitorios (Graph, red, DB) — Meta reintenta con backoff.
  return error instanceof Error;
}

// Público — sin JWT (PLAN.md §7, §8.2). Se protege con el ?token= de la URL,
// hub.verify_token (GET) y la firma HMAC del body (POST).
@ApiTags('Meta Webhooks')
@Controller('meta/webhooks')
export class MetaWebhooksController {
  private readonly logger = new Logger(MetaWebhooksController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly verificarWebhook: VerificarWebhookMetaUseCase,
    private readonly procesarLead: ProcesarLeadEntranteUseCase,
    private readonly autoAsignarLead: AutoAsignarLeadUseCase,
    private readonly crearNotificacion: CrearNotificacionUseCase,
    private readonly procesarMensajeWhatsApp: ProcesarMensajeWhatsAppEntranteUseCase,
    private readonly procesarEcoMensajeWhatsApp: ProcesarEcoMensajeWhatsAppUseCase,
    private readonly procesarEstadoWhatsApp: ProcesarEstadoWhatsAppUseCase,
    private readonly procesarReaccionWhatsApp: ProcesarReaccionWhatsAppUseCase,
    private readonly procesarEdicionWhatsApp: ProcesarEdicionWhatsAppUseCase,
    private readonly procesarLlamadaWhatsApp: ProcesarLlamadaWebhookUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Verificación del webhook (handshake de Meta)',
    description:
      'Endpoint público que Meta llama al configurar la suscripción del webhook (leadgen o WhatsApp) para ' +
      'confirmar que es dueño de la URL. Valida el `?token=` propio y el `hub.verify_token` de Meta, y si ' +
      'ambos son correctos devuelve `hub.challenge` en texto plano.',
  })
  @ApiQuery({
    name: 'token',
    description:
      'Token propio de esta URL de webhook (no confundir con hub.verify_token)',
  })
  @ApiQuery({
    name: 'hub.mode',
    description: 'Siempre "subscribe", enviado por Meta',
  })
  @ApiQuery({
    name: 'hub.verify_token',
    description: 'Token de verificación configurado en la app de Meta',
  })
  @ApiQuery({
    name: 'hub.challenge',
    description:
      'Valor que Meta espera recibir de vuelta si la verificación es correcta',
  })
  @ApiResponse({
    status: 200,
    description:
      'Verificación correcta — devuelve hub.challenge en texto plano.',
  })
  @ApiResponse({
    status: 403,
    description: 'Token de URL o verify_token incorrectos.',
  })
  async verify(
    @Query('token') token: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): Promise<void> {
    const urlTokenValido =
      token === this.config.getOrThrow<string>('META_WEBHOOK_URL_TOKEN');
    const verifyTokenValido = await this.verificarWebhook.esSuscripcionValida(
      mode,
      verifyToken,
    );

    if (urlTokenValido && verifyTokenValido) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Forbidden');
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recepción de eventos (leads y WhatsApp)',
    description:
      'Endpoint público que Meta invoca en tiempo real con los eventos suscritos. Un mismo endpoint recibe ' +
      'dos tipos de payload, distinguidos por `object`: `"page"` con leads nuevos (leadgen) y ' +
      '`"whatsapp_business_account"` con mensajes/estados de WhatsApp entrantes. Verifica el `?token=` propio ' +
      'y la firma HMAC `X-Hub-Signature-256` del body crudo. Fallos reintentables responden 5xx para que ' +
      'Meta reintente; errores terminales (page sin conexión, etc.) ACK 200.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Token propio de esta URL de webhook',
  })
  @ApiResponse({
    status: 200,
    description: 'Evento procesado (o rechazado de forma terminal).',
  })
  @ApiResponse({
    status: 403,
    description: 'Token de URL incorrecto o firma HMAC inválida.',
  })
  @ApiResponse({
    status: 503,
    description: 'Fallo reintentable — Meta debe reintentar el webhook.',
  })
  async receive(
    @Query('token') token: string,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ): Promise<void> {
    if (token !== this.config.getOrThrow<string>('META_WEBHOOK_URL_TOKEN')) {
      res.status(403).send();
      return;
    }

    const payload = req.body as LeadgenWebhookPayload;
    if (
      !req.rawBody ||
      !(await this.verificarWebhook.verificarFirma(
        req.rawBody,
        signature,
        payload,
      ))
    ) {
      this.logger.warn('Firma de webhook inválida');
      res.status(403).send();
      return;
    }

    let huboFalloReintentable = false;

    if (payload.object === 'whatsapp_business_account') {
      huboFalloReintentable = await this.procesarEventosWhatsApp(
        payload as unknown as WhatsappWebhookPayload,
      );
    } else {
      const eventos = extraerEventosLeadgen(payload);
      huboFalloReintentable = await this.procesarEventosLeadgen(eventos);
    }

    if (huboFalloReintentable) {
      res.status(503).send('Retry');
      return;
    }
    res.status(200).send('OK');
  }

  private async procesarEventosWhatsApp(
    payload: WhatsappWebhookPayload,
  ): Promise<boolean> {
    const { mensajes, ecos, estados, reacciones, ediciones, llamadas } =
      extraerEventosWhatsApp(payload);
    let huboFalloReintentable = false;

    for (const evento of mensajes) {
      try {
        await this.procesarMensajeWhatsApp.execute(evento);
      } catch (error) {
        this.logger.error(
          `Error procesando mensaje WhatsApp ${evento.wamid} (phone_number_id ${evento.phoneNumberId})`,
          error instanceof Error ? error.stack : error,
        );
        if (esErrorReintentable(error)) huboFalloReintentable = true;
      }
    }

    for (const evento of ecos) {
      try {
        await this.procesarEcoMensajeWhatsApp.execute(evento);
      } catch (error) {
        this.logger.error(
          `Error procesando eco WhatsApp ${evento.wamid} (phone_number_id ${evento.phoneNumberId})`,
          error instanceof Error ? error.stack : error,
        );
        if (esErrorReintentable(error)) huboFalloReintentable = true;
      }
    }

    for (const evento of estados) {
      try {
        await this.procesarEstadoWhatsApp.execute(evento);
      } catch (error) {
        this.logger.error(
          `Error procesando estado WhatsApp ${evento.wamid}`,
          error instanceof Error ? error.stack : error,
        );
        if (esErrorReintentable(error)) huboFalloReintentable = true;
      }
    }

    for (const evento of reacciones) {
      try {
        await this.procesarReaccionWhatsApp.execute(evento);
      } catch (error) {
        this.logger.error(
          `Error procesando reacción WhatsApp sobre ${evento.wamidObjetivo}`,
          error instanceof Error ? error.stack : error,
        );
        if (esErrorReintentable(error)) huboFalloReintentable = true;
      }
    }

    for (const evento of ediciones) {
      try {
        await this.procesarEdicionWhatsApp.execute(evento);
      } catch (error) {
        this.logger.error(
          `Error procesando edición WhatsApp sobre ${evento.wamidOriginal}`,
          error instanceof Error ? error.stack : error,
        );
        if (esErrorReintentable(error)) huboFalloReintentable = true;
      }
    }

    for (const evento of llamadas) {
      try {
        await this.procesarLlamadaWhatsApp.execute(evento);
      } catch (error) {
        this.logger.error(
          `Error procesando llamada WhatsApp ${evento.callId} (phone_number_id ${evento.phoneNumberId})`,
          error instanceof Error ? error.stack : error,
        );
        if (esErrorReintentable(error)) huboFalloReintentable = true;
      }
    }

    return huboFalloReintentable;
  }

  private async procesarEventosLeadgen(
    eventos: ReturnType<typeof extraerEventosLeadgen>,
  ): Promise<boolean> {
    let procesados = 0;
    let rechazadosPageId = 0;
    let huboFalloReintentable = false;

    for (const evento of eventos) {
      try {
        const resultado = await this.procesarLead.execute(
          evento.pageId,
          evento.leadgenId,
        );
        procesados += 1;

        if (
          resultado.creado === true &&
          resultado.leadId &&
          resultado.organizacionId
        ) {
          let usuarioIds: string[] | undefined;
          try {
            const asignacion = await this.autoAsignarLead.execute(
              resultado.organizacionId,
              resultado.leadId,
            );
            usuarioIds = asignacion.asignadoUsuarioId
              ? [asignacion.asignadoUsuarioId]
              : undefined;
          } catch (error: unknown) {
            this.logger.error(
              'Error auto-asignando lead entrante',
              error instanceof Error ? error.stack : error,
            );
            usuarioIds = undefined;
          }

          void this.crearNotificacion
            .execute({
              organizacionId: resultado.organizacionId,
              tipo: 'LEAD_NUEVO',
              titulo: 'Nuevo lead',
              mensaje: 'Llegó un nuevo lead desde Meta.',
              payload: {
                leadId: resultado.leadId,
                url: `/leads/${resultado.leadId}`,
              },
              usuarioIds,
            })
            .catch((error: unknown) =>
              this.logger.error(
                'Error creando notificación de lead nuevo',
                error instanceof Error ? error.stack : error,
              ),
            );
        }
      } catch (error) {
        if (error instanceof PageSinConexionError) {
          rechazadosPageId += 1;
          this.logger.error(
            `Webhook leadgen rechazado: page_id ${error.pageId} sin conexión activa (leadgen ${evento.leadgenId})`,
          );
          continue;
        }
        this.logger.error(
          `Error procesando leadgen ${evento.leadgenId} (page ${evento.pageId})`,
          error instanceof Error ? error.stack : error,
        );
        if (esErrorReintentable(error)) huboFalloReintentable = true;
      }
    }

    if (
      eventos.length > 0 &&
      procesados === 0 &&
      rechazadosPageId === eventos.length
    ) {
      this.logger.error(
        `Webhook leadgen: ${rechazadosPageId} evento(s) rechazados — ningún page_id tiene conexión activa`,
      );
    }

    return huboFalloReintentable;
  }
}
