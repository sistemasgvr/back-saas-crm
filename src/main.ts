import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigIoAdapter } from './shared/infrastructure/config-io.adapter';

async function bootstrap() {
  // rawBody: true — el webhook de Meta necesita los bytes exactos del body
  // para verificar la firma HMAC (X-Hub-Signature-256), antes de que Nest
  // lo parsee a JSON (PLAN.md §8.2).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL'),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useWebSocketAdapter(new ConfigIoAdapter(app));

  // Swagger — expuesto en /api/docs (dentro del prefijo global, junto al
  // resto de la API). No se activa en producción para no exponer el mapa
  // completo de endpoints a quien no lo necesita.
  if (config.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SAAS CRM API')
      .setDescription(
        'API del CRM multi-tenant: gestión de leads de Meta Lead Ads, ' +
          'campañas/anuncios, chats de WhatsApp Cloud API, organizaciones, ' +
          'usuarios y administración de plataforma. Todos los endpoints ' +
          '(salvo auth y webhooks de Meta) requieren un JWT Bearer emitido ' +
          'por /api/auth/login y, salvo los de platform-admin, el header ' +
          'de organización activa resuelto por el propio token.',
      )
      .setVersion(process.env.npm_package_version ?? '0.0.1')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .addTag('Health', 'Endpoints de humo/monitoreo, sin autenticación')
      .addTag('Auth', 'Login, refresh de sesión y perfil propio')
      .addTag(
        'Organizations',
        'Datos y configuración de la organización activa',
      )
      .addTag('Dashboard', 'KPIs y series agregadas para el panel principal')
      .addTag('Leads', 'Listado, asignación y gestión de leads')
      .addTag(
        'Meta Connections',
        'Vinculación de la cuenta de Meta (OAuth, permisos, credenciales)',
      )
      .addTag('Meta Pages', 'Páginas de Facebook vinculadas')
      .addTag(
        'Meta Forms',
        'Formularios de Lead Ads y su sincronización/backfill',
      )
      .addTag('Meta Ad Accounts', 'Cuentas publicitarias vinculadas')
      .addTag('Meta Campaigns', 'Campañas publicitarias de Meta')
      .addTag('Meta Ad Sets', 'Conjuntos de anuncios de Meta')
      .addTag('Meta Ads', 'Anuncios individuales de Meta')
      .addTag('Meta Insights', 'Métricas de rendimiento (insights) de Meta')
      .addTag(
        'Meta Webhooks',
        'Endpoints públicos que consume Meta (leads/mensajes entrantes)',
      )
      .addTag(
        'WhatsApp Connections',
        'Vinculación de números de WhatsApp Cloud API',
      )
      .addTag(
        'WhatsApp Chats',
        'Conversaciones, mensajes y plantillas de WhatsApp',
      )
      .addTag(
        'Notifications',
        'Notificaciones in-app y suscripciones de Web Push',
      )
      .addTag(
        'Platform Admin',
        'Administración global de la plataforma (super-admin)',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Hostinger inyecta PORT. En local cae a 4000. Nunca fijes PORT en hPanel.
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isFinite(port) || port <= 0) {
    console.error('[bootstrap] PORT inválido:', process.env.PORT);
    process.exit(1);
  }

  await app.listen(port, '0.0.0.0');
  console.log(
    `[bootstrap] NestJS OK — 0.0.0.0:${port} (NODE_ENV=${config.get('NODE_ENV')})`,
  );
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
