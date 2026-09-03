import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispararRecordatoriosAgendaUseCase } from '../application/use-cases/disparar-recordatorios-agenda.use-case';

/**
 * En procesos long-running (local / Hostinger) dispara el tick cada minuto.
 * En Vercel (`VERCEL=1`) no corre: allí el cron de vercel.json llama al
 * endpoint HTTP — Nest Schedule no es viable (ESM + serverless).
 */
@Injectable()
export class AgendaRecordatoriosInlineTicker implements OnModuleInit {
  private readonly logger = new Logger(AgendaRecordatoriosInlineTicker.name);
  private corriendo = false;

  constructor(
    private readonly disparar: DispararRecordatoriosAgendaUseCase,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('VERCEL') === '1') return;
    const desactivado =
      this.config.get<string>('AGENDA_INLINE_CRON') === '0' ||
      this.config.get<string>('AGENDA_INLINE_CRON') === 'false';
    if (desactivado) return;

    this.logger.log('Recordatorios de agenda: ticker inline cada 60s');
    setInterval(() => {
      void this.tick();
    }, 60_000);
    // Primera pasada un poco después del boot (deja que Prisma conecte).
    setTimeout(() => {
      void this.tick();
    }, 15_000);
  }

  private async tick(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      await this.disparar.execute();
    } catch (err) {
      this.logger.error(
        `Error en recordatorios de agenda: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.corriendo = false;
    }
  }
}
