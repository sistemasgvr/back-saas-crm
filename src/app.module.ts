import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  envValidationOptions,
  envValidationSchema,
} from './shared/infrastructure/env.validation';
import { PrismaModule } from './shared/infrastructure/prisma.module';
import { RequestLoggerMiddleware } from './shared/presentation/middleware/request-logger.middleware';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ModulesModule } from './modules/modules.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { MetaModule } from './meta/meta.module';
import { LeadsModule } from './leads/leads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // El primer archivo encontrado gana por variable; NODE_ENV lo fija cada
      // script de package.json (cross-env) — local usa .env.development, Hostinger
      // usa .env.production si existe o las variables ya inyectadas por hPanel.
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validationSchema: envValidationSchema,
      validationOptions: envValidationOptions,
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    ModulesModule,
    DashboardModule,
    PlatformAdminModule,
    MetaModule,
    LeadsModule,
    NotificationsModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Watcher de solicitudes en tiempo real — solo en desarrollo (ver
    // RequestLoggerMiddleware). En producción no se registra: cero overhead.
    if ((process.env.NODE_ENV ?? 'development') !== 'production') {
      consumer.apply(RequestLoggerMiddleware).forRoutes('*');
    }
  }
}
