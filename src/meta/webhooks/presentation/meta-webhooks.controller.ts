import { Controller, Get, Headers, HttpCode, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProcesarLeadEntranteUseCase } from '../../leads/application/use-cases/procesar-lead-entrante.use-case';
import { extraerEventosLeadgen } from '../domain/leadgen-webhook-payload.interface';
import type { LeadgenWebhookPayload } from '../domain/leadgen-webhook-payload.interface';
import { verificarFirmaWebhook } from '../infrastructure/verificar-firma-webhook';

// Público — sin JWT (PLAN.md §7, §8.2). Se protege con el ?token= de la URL,
// hub.verify_token (GET) y la firma HMAC del body (POST).
@Controller('meta/webhooks')
export class MetaWebhooksController {
  private readonly logger = new Logger(MetaWebhooksController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly procesarLead: ProcesarLeadEntranteUseCase,
  ) {}

  @Get()
  verify(
    @Query('token') token: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const urlTokenValido = token === this.config.getOrThrow<string>('META_WEBHOOK_URL_TOKEN');
    const verifyTokenValido =
      mode === 'subscribe' && verifyToken === this.config.getOrThrow<string>('META_VERIFY_TOKEN');

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

    const appSecret = this.config.getOrThrow<string>('META_APP_SECRET');
    if (!req.rawBody || !verificarFirmaWebhook(req.rawBody, signature, appSecret)) {
      this.logger.warn('Firma de webhook inválida');
      res.status(403).send();
      return;
    }

    const eventos = extraerEventosLeadgen(req.body as LeadgenWebhookPayload);

    try {
      for (const evento of eventos) {
        await this.procesarLead.execute(evento.pageId, evento.leadgenId);
      }
      res.status(200).send('OK');
    } catch (error) {
      // Graph API falló u otro error transitorio: 5xx para que Meta reintente (PLAN.md §8.2).
      this.logger.error('Error procesando webhook de leads', error instanceof Error ? error.stack : error);
      res.status(500).send('retry');
    }
  }
}
