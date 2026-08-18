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

  // Hostinger/Passenger inyecta PORT — no usar fallback 4000 (provoca 503).
  const port = Number(process.env.PORT);
  if (!Number.isFinite(port)) {
    console.error(
      '[bootstrap] PORT no está definido. En Hostinger NO fijes PORT en hPanel; Passenger lo inyecta al arrancar.',
    );
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
