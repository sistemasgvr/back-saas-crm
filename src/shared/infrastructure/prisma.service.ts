import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
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

  // Después de beforeApplicationShutdown: permite drenar la auditoría pendiente.
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
