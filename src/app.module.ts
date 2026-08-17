import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './shared/infrastructure/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ModulesModule } from './modules/modules.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { MetaModule } from './meta/meta.module';
import { LeadsModule } from './leads/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    ModulesModule,
    DashboardModule,
    PlatformAdminModule,
    MetaModule,
    LeadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
