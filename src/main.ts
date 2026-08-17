import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true — el webhook de Meta necesita los bytes exactos del body
  // para verificar la firma HMAC (X-Hub-Signature-256), antes de que Nest
  // lo parsee a JSON (PLAN.md §8.2).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
