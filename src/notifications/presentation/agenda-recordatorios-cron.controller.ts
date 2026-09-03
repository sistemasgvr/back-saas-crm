import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { DispararRecordatoriosAgendaUseCase } from '../application/use-cases/disparar-recordatorios-agenda.use-case';

/**
 * Endpoint para Vercel Cron (y crons externos).
 * Vercel invoca GET con Authorization: Bearer <CRON_SECRET>.
 * También acepta POST + header x-cron-secret.
 */
@ApiExcludeController()
@Controller('notifications/agenda-reminders')
export class AgendaRecordatoriosCronController {
  constructor(
    private readonly disparar: DispararRecordatoriosAgendaUseCase,
    private readonly config: ConfigService,
  ) {}

  @Get('tick')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tick de recordatorios de agenda (Vercel Cron)' })
  async tickGet(
    @Headers('authorization') authorization?: string,
    @Headers('x-cron-secret') cronHeader?: string,
  ) {
    return this.run(authorization, cronHeader);
  }

  @Post('tick')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tick de recordatorios de agenda (cron manual)' })
  async tickPost(
    @Headers('authorization') authorization?: string,
    @Headers('x-cron-secret') cronHeader?: string,
  ) {
    return this.run(authorization, cronHeader);
  }

  private async run(authorization?: string, cronHeader?: string) {
    this.assertSecret(authorization, cronHeader);
    const enviados = await this.disparar.execute();
    return { ok: true, enviados };
  }

  private assertSecret(
    authorization?: string,
    cronHeader?: string,
  ): void {
    const secret = this.config.get<string>('CRON_SECRET')?.trim();
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET no configurado');
    }
    const bearerOk =
      typeof authorization === 'string' &&
      authorization === `Bearer ${secret}`;
    const headerOk = typeof cronHeader === 'string' && cronHeader === secret;
    if (!bearerOk && !headerOk) {
      throw new UnauthorizedException('Cron no autorizado');
    }
  }
}
