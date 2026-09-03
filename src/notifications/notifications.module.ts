import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './presentation/notifications.controller';
import { NotificacionesGateway } from './presentation/notificaciones.gateway';
import { WsTicketService } from './infrastructure/ws-ticket.service';
import { PrismaNotificacionesRepository } from './infrastructure/prisma-notificaciones.repository';
import { WebPushSender } from './infrastructure/web-push.sender';
import { AgendaRecordatoriosScheduler } from './infrastructure/agenda-recordatorios.scheduler';
import { NOTIFICACIONES_REPOSITORY } from './application/ports/notificaciones.repository.port';
import { WS_EMITTER } from './application/ports/ws-emitter.port';
import { PUSH_SENDER } from './application/ports/push-sender.port';
import { CrearNotificacionUseCase } from './application/use-cases/crear-notificacion.use-case';
import { ListarNotificacionesUseCase } from './application/use-cases/listar-notificaciones.use-case';
import { ContarNoLeidasUseCase } from './application/use-cases/contar-no-leidas.use-case';
import { MarcarLeidaUseCase } from './application/use-cases/marcar-leida.use-case';
import { MarcarTodasLeidasUseCase } from './application/use-cases/marcar-todas-leidas.use-case';
import { DispararRecordatoriosAgendaUseCase } from './application/use-cases/disparar-recordatorios-agenda.use-case';
import { RegistrarSuscripcionPushUseCase } from './application/use-cases/registrar-suscripcion-push.use-case';
import { EliminarSuscripcionPushUseCase } from './application/use-cases/eliminar-suscripcion-push.use-case';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    CrearNotificacionUseCase,
    ListarNotificacionesUseCase,
    ContarNoLeidasUseCase,
    MarcarLeidaUseCase,
    MarcarTodasLeidasUseCase,
    DispararRecordatoriosAgendaUseCase,
    RegistrarSuscripcionPushUseCase,
    EliminarSuscripcionPushUseCase,
    AgendaRecordatoriosScheduler,
    WsTicketService,
    NotificacionesGateway,
    WebPushSender,
    {
      provide: NOTIFICACIONES_REPOSITORY,
      useClass: PrismaNotificacionesRepository,
    },
    { provide: WS_EMITTER, useExisting: NotificacionesGateway },
    { provide: PUSH_SENDER, useExisting: WebPushSender },
  ],
  exports: [CrearNotificacionUseCase],
})
export class NotificationsModule {}
