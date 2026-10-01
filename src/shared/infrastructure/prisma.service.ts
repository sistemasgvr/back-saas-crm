import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conectado a PostgreSQL');
    } catch (error: unknown) {
      this.logger.error({ err: error }, 'Fallo al conectar a PostgreSQL');
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
