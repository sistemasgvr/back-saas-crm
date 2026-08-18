import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './presentation/notifications.controller';
import { NotificacionesGateway } from './presentation/notificaciones.gateway';
import { WsTicketService } from './infrastructure/ws-ticket.service';
import { PrismaNotificacionesRepository } from './infrastructure/prisma-notificaciones.repository';
import { NOTIFICACIONES_REPOSITORY } from './application/ports/notificaciones.repository.port';
import { WS_EMITTER } from './application/ports/ws-emitter.port';
import { CrearNotificacionUseCase } from './application/use-cases/crear-notificacion.use-case';
import { ListarNotificacionesUseCase } from './application/use-cases/listar-notificaciones.use-case';
import { ContarNoLeidasUseCase } from './application/use-cases/contar-no-leidas.use-case';
import { MarcarLeidaUseCase } from './application/use-cases/marcar-leida.use-case';
import { MarcarTodasLeidasUseCase } from './application/use-cases/marcar-todas-leidas.use-case';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    CrearNotificacionUseCase,
    ListarNotificacionesUseCase,
    ContarNoLeidasUseCase,
    MarcarLeidaUseCase,
    MarcarTodasLeidasUseCase,
    WsTicketService,
    NotificacionesGateway,
    {
      provide: NOTIFICACIONES_REPOSITORY,
      useClass: PrismaNotificacionesRepository,
    },
    { provide: WS_EMITTER, useExisting: NotificacionesGateway },
  ],
  exports: [CrearNotificacionUseCase],
})
export class NotificationsModule {}
