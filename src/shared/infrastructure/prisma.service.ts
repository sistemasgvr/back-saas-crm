import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('[prisma] Conectado a PostgreSQL');
    } catch (error) {
      console.error(
        '[prisma] Fallo al conectar (revisa DATABASE_URL en hPanel):',
      );
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error(error);
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
