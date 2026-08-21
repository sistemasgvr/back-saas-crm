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
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProcesarLeadEntranteUseCase } from '../../leads/application/use-cases/procesar-lead-entrante.use-case';
import { PageSinConexionError } from '../../leads/application/errors/page-sin-conexion.error';
import { extraerEventosLeadgen } from '../domain/leadgen-webhook-payload.interface';
import type { LeadgenWebhookPayload } from '../domain/leadgen-webhook-payload.interface';
import { VerificarWebhookMetaUseCase } from '../application/use-cases/verificar-webhook-meta.use-case';
import { CrearNotificacionUseCase } from '../../../notifications/application/use-cases/crear-notificacion.use-case';

// Público — sin JWT (PLAN.md §7, §8.2). Se protege con el ?token= de la URL,
// hub.verify_token (GET) y la firma HMAC del body (POST).
@Controller('meta/webhooks')
export class MetaWebhooksController {
  private readonly logger = new Logger(MetaWebhooksController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly verificarWebhook: VerificarWebhookMetaUseCase,
    private readonly procesarLead: ProcesarLeadEntranteUseCase,
    private readonly crearNotificacion: CrearNotificacionUseCase,
  ) {}

  @Get()
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

    // ACK inmediato: Meta CRM guidance prefiera 200 rápido + ingest async.
    // Tradeoff: ya no podemos devolver 5xx para que Meta reintente Graph failures;
    // confiamos en ingest idempotente + backfill manual.
    res.status(200).send('OK');

    const eventos = extraerEventosLeadgen(payload);
    void this.procesarEventosEnBackground(eventos);
  }

  private async procesarEventosEnBackground(
    eventos: ReturnType<typeof extraerEventosLeadgen>,
  ): Promise<void> {
    let procesados = 0;
    let rechazadosPageId = 0;

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
          void this.crearNotificacion
            .execute({
              organizacionId: resultado.organizacionId,
              tipo: 'LEAD_NUEVO',
              titulo: 'Nuevo lead',
              mensaje: 'Llegó un nuevo lead desde Meta.',
              payload: { leadId: resultado.leadId },
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
        // Ya ACK 200: no hay retry vía 5xx. Log + idempotencia/backfill.
        this.logger.error(
          `Error procesando leadgen ${evento.leadgenId} (page ${evento.pageId})`,
          error instanceof Error ? error.stack : error,
        );
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
  }
}
