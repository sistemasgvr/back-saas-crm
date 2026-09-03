import { Module, forwardRef } from '@nestjs/common';
import { MetaConnectionsModule } from '../../meta/connections/meta-connections.module';
import { WhatsappConnectionsModule } from '../connections/whatsapp-connections.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { LeadsModule } from '../../leads/leads.module';
import { WhatsappChatsController } from './presentation/whatsapp-chats.controller';
import { ListarConversacionesUseCase } from './application/use-cases/listar-conversaciones.use-case';
import { ContarNoLeidosWhatsAppUseCase } from './application/use-cases/contar-no-leidos-whatsapp.use-case';
import { ObtenerConversacionUseCase } from './application/use-cases/obtener-conversacion.use-case';
import { EnviarMensajeWhatsAppUseCase } from './application/use-cases/enviar-mensaje-whatsapp.use-case';
import { EnviarReaccionWhatsAppUseCase } from './application/use-cases/enviar-reaccion-whatsapp.use-case';
import { EnviarMediaWhatsAppUseCase } from './application/use-cases/enviar-media-whatsapp.use-case';
import { EnviarUbicacionWhatsAppUseCase } from './application/use-cases/enviar-ubicacion-whatsapp.use-case';
import { EnviarContactoWhatsAppUseCase } from './application/use-cases/enviar-contacto-whatsapp.use-case';
import { EnviarInteractivoWhatsAppUseCase } from './application/use-cases/enviar-interactivo-whatsapp.use-case';
import { MarcarLeidoWhatsAppUseCase } from './application/use-cases/marcar-leido-whatsapp.use-case';
import { ObtenerMediaMensajeUseCase } from './application/use-cases/obtener-media-mensaje.use-case';
import { ListarPlantillasUseCase } from './application/use-cases/listar-plantillas.use-case';
import { CrearPlantillaUseCase } from './application/use-cases/crear-plantilla.use-case';
import { ProcesarMensajeWhatsAppEntranteUseCase } from './application/use-cases/procesar-mensaje-whatsapp-entrante.use-case';
import { ProcesarEcoMensajeWhatsAppUseCase } from './application/use-cases/procesar-eco-mensaje-whatsapp.use-case';
import { ProcesarEstadoWhatsAppUseCase } from './application/use-cases/procesar-estado-whatsapp.use-case';
import { ProcesarReaccionWhatsAppUseCase } from './application/use-cases/procesar-reaccion-whatsapp.use-case';
import { ProcesarEdicionWhatsAppUseCase } from './application/use-cases/procesar-edicion-whatsapp.use-case';
import { IniciarConversacionDesdeLeadUseCase } from './application/use-cases/iniciar-conversacion-desde-lead.use-case';
import { VincularLeadConversacionesWhatsAppUseCase } from './application/use-cases/vincular-lead-conversaciones-whatsapp.use-case';
import { BloquearContactoWhatsAppUseCase } from './application/use-cases/bloquear-contacto-whatsapp.use-case';
import { EliminarMensajeWhatsAppCrmUseCase } from './application/use-cases/eliminar-mensaje-whatsapp-crm.use-case';
import { ReenviarMensajeWhatsAppUseCase } from './application/use-cases/reenviar-mensaje-whatsapp.use-case';
import { WHATSAPP_CONVERSACIONES_REPOSITORY } from './application/ports/whatsapp-conversaciones.repository.port';
import { PrismaWhatsappConversacionesRepository } from './infrastructure/prisma-whatsapp-conversaciones.repository';

@Module({
  imports: [
    forwardRef(() => MetaConnectionsModule),
    WhatsappConnectionsModule,
    NotificationsModule,
    LeadsModule,
  ],
  controllers: [WhatsappChatsController],
  providers: [
    ListarConversacionesUseCase,
    ContarNoLeidosWhatsAppUseCase,
    ObtenerConversacionUseCase,
    EnviarMensajeWhatsAppUseCase,
    EnviarReaccionWhatsAppUseCase,
    EnviarMediaWhatsAppUseCase,
    EnviarUbicacionWhatsAppUseCase,
    EnviarContactoWhatsAppUseCase,
    EnviarInteractivoWhatsAppUseCase,
    MarcarLeidoWhatsAppUseCase,
    ObtenerMediaMensajeUseCase,
    ListarPlantillasUseCase,
    CrearPlantillaUseCase,
    ProcesarMensajeWhatsAppEntranteUseCase,
    ProcesarEcoMensajeWhatsAppUseCase,
    ProcesarEstadoWhatsAppUseCase,
    ProcesarReaccionWhatsAppUseCase,
    ProcesarEdicionWhatsAppUseCase,
    IniciarConversacionDesdeLeadUseCase,
    VincularLeadConversacionesWhatsAppUseCase,
    BloquearContactoWhatsAppUseCase,
    EliminarMensajeWhatsAppCrmUseCase,
    ReenviarMensajeWhatsAppUseCase,
    {
      provide: WHATSAPP_CONVERSACIONES_REPOSITORY,
      useClass: PrismaWhatsappConversacionesRepository,
    },
  ],
  exports: [
    ProcesarMensajeWhatsAppEntranteUseCase,
    ProcesarEcoMensajeWhatsAppUseCase,
    ProcesarEstadoWhatsAppUseCase,
    ProcesarReaccionWhatsAppUseCase,
    ProcesarEdicionWhatsAppUseCase,
    VincularLeadConversacionesWhatsAppUseCase,
  ],
})
export class WhatsappMessagingModule {}
