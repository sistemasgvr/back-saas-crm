import { AdminWhatsappBotController } from '../../platform-admin/presentation/admin-whatsapp-bot.controller';
import { WhatsappBotAdminService } from '../../platform-admin/application/whatsapp-bot-admin.service';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { OBJECT_STORAGE } from '../../shared/application/ports/object-storage.port';
import { ControlAtencionService } from './application/control-atencion.service';
import { WhatsappChatsController } from './presentation/whatsapp-chats.controller';
import { SolicitarPermisoLlamadaUseCase } from '../calls/application/use-cases/solicitar-permiso-llamada.use-case';

it('resuelve módulos de chat, llamadas y notificaciones sin conectar servicios externos', async () => {
  const env = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/whatsapp_control_test',
    FRONTEND_URL: 'http://localhost:3000',
    JWT_ACCESS_SECRET: 'synthetic-access-secret-for-test',
    JWT_REFRESH_SECRET: 'synthetic-refresh-secret-for-test',
    META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    META_VERIFY_TOKEN: 'synthetic-verify',
    META_WEBHOOK_URL_TOKEN: 'synthetic-webhook',
    META_OAUTH_REDIRECT_URI: 'http://localhost:3000/callback',
    MINIO_SERVER_URL: 'http://localhost:9000',
    MINIO_ROOT_USER: 'synthetic',
    MINIO_ROOT_PASSWORD: 'synthetic',
  };
  const anterior = Object.fromEntries(
    Object.keys(env).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, env);
  try {
    const { AppModule } = await import('../../app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(OBJECT_STORAGE)
      .useValue({})
      .compile();
    // No init(): no cron, sockets, MinIO ni conexión PostgreSQL.
    expect(module.get(ControlAtencionService)).toBeInstanceOf(
      ControlAtencionService,
    );
    expect(module.get(WhatsappChatsController)).toBeInstanceOf(
      WhatsappChatsController,
    );
    expect(module.get(SolicitarPermisoLlamadaUseCase)).toBeInstanceOf(
      SolicitarPermisoLlamadaUseCase,
    );
    expect(module.get(AdminWhatsappBotController)).toBeInstanceOf(
      AdminWhatsappBotController,
    );
    expect(module.get(WhatsappBotAdminService)).toBeInstanceOf(
      WhatsappBotAdminService,
    );
    await module.close();
  } finally {
    for (const [k, v] of Object.entries(anterior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
