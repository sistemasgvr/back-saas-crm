import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { createHttpLoggerOptions } from './shared/infrastructure/logging.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  envValidationOptions,
  envValidationSchema,
} from './shared/infrastructure/env.validation';
import { PrismaModule } from './shared/infrastructure/prisma.module';
import { ObjectStorageModule } from './shared/infrastructure/object-storage.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ModulesModule } from './modules/modules.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { MetaModule } from './meta/meta.module';
import { LeadsModule } from './leads/leads.module';
import { InmueblesModule } from './inmuebles/inmuebles.module';
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
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: createHttpLoggerOptions(config.get<string>('LOG_LEVEL')),
      }),
    }),
    PrismaModule,
    ObjectStorageModule,
    AuthModule,
    OrganizationsModule,
    ModulesModule,
    DashboardModule,
    PlatformAdminModule,
    MetaModule,
    LeadsModule,
    InmueblesModule,
    NotificationsModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
