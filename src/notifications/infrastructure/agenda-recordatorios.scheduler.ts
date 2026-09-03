import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DispararRecordatoriosAgendaUseCase } from '../application/use-cases/disparar-recordatorios-agenda.use-case';

@Injectable()
export class AgendaRecordatoriosScheduler {
  private readonly logger = new Logger(AgendaRecordatoriosScheduler.name);
  private corriendo = false;

  constructor(
    private readonly disparar: DispararRecordatoriosAgendaUseCase,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
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
