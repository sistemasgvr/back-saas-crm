import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsappMessagingModule } from '../whatsapp/messaging/whatsapp-messaging.module';
import { GestionMembresiasService } from './application/gestion-membresias.service';
import { UsuariosEmpresaController } from './presentation/usuarios-empresa.controller';
import { RolesEmpresaController } from './presentation/roles-empresa.controller';
import { RolesEmpresaService } from './application/roles-empresa.service';
import { NotificationsModule } from '../notifications/notifications.module';

// Separado de OrganizationsModule, que LeadsModule necesita para el pipeline.
@Module({
  imports: [AuthModule, WhatsappMessagingModule, NotificationsModule],
  controllers: [UsuariosEmpresaController, RolesEmpresaController],
  providers: [GestionMembresiasService, RolesEmpresaService],
  exports: [GestionMembresiasService],
})
export class MembresiasModule {}
