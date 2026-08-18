import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true — el webhook de Meta necesita los bytes exactos del body
  // para verificar la firma HMAC (X-Hub-Signature-256), antes de que Nest
  // lo parsee a JSON (PLAN.md §8.2).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get<string>('FRONTEND_URL'), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Hostinger inyecta PORT. En local cae a 4000. Nunca fijes PORT en hPanel.
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isFinite(port) || port <= 0) {
    console.error('[bootstrap] PORT inválido:', process.env.PORT);
    process.exit(1);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`[bootstrap] NestJS OK — 0.0.0.0:${port} (NODE_ENV=${config.get('NODE_ENV')})`);
}

void bootstrap().catch((error) => {
  console.error('[bootstrap] NestJS falló al arrancar:');
  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) console.error(error.stack);
  } else {
    console.error(error);
  }
  process.exit(1);
});
