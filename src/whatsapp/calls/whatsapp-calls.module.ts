import { Module, forwardRef } from '@nestjs/common';
import { MetaConnectionsModule } from '../../meta/connections/meta-connections.module';
import { WhatsappConnectionsModule } from '../connections/whatsapp-connections.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { PrismaModule } from '../../shared/infrastructure/prisma.module';
import { WhatsappCallsController } from './presentation/whatsapp-calls.controller';
import { WHATSAPP_LLAMADAS_REPOSITORY } from './application/ports/whatsapp-llamadas.repository.port';
import { PrismaWhatsappLlamadasRepository } from './infrastructure/prisma-whatsapp-llamadas.repository';
import { LlamadaPresenciaService } from './infrastructure/llamada-presencia.service';
import { ProcesarLlamadaWebhookUseCase } from './application/use-cases/procesar-llamada-webhook.use-case';
import { PreAcceptLlamadaUseCase } from './application/use-cases/pre-accept-llamada.use-case';
import { AcceptLlamadaUseCase } from './application/use-cases/accept-llamada.use-case';
import { RejectLlamadaUseCase } from './application/use-cases/reject-llamada.use-case';
import { TerminateLlamadaUseCase } from './application/use-cases/terminate-llamada.use-case';
import { IniciarLlamadaSalienteUseCase } from './application/use-cases/iniciar-llamada-saliente.use-case';
import { SolicitarPermisoLlamadaUseCase } from './application/use-cases/solicitar-permiso-llamada.use-case';
import { ObtenerPermisoLlamadaUseCase } from './application/use-cases/obtener-permiso-llamada.use-case';
import { ListarLlamadasUseCase } from './application/use-cases/listar-llamadas.use-case';
import { ObtenerLlamadaUseCase } from './application/use-cases/obtener-llamada.use-case';
import { ActualizarLlamadaUseCase } from './application/use-cases/actualizar-llamada.use-case';
import { ObtenerIceServersUseCase } from './application/use-cases/obtener-ice-servers.use-case';
import { ObtenerSettingsLlamadaUseCase } from './application/use-cases/obtener-settings-llamada.use-case';
import { ActualizarSettingsLlamadaUseCase } from './application/use-cases/actualizar-settings-llamada.use-case';
import { SetPresenciaLlamadasUseCase } from './application/use-cases/set-presencia-llamadas.use-case';
import { GetPresenciaLlamadasUseCase } from './application/use-cases/get-presencia-llamadas.use-case';
import { ObtenerCapacidadCallingOrgUseCase } from './application/use-cases/obtener-capacidad-calling-org.use-case';
import { MetricasLlamadasUseCase } from './application/use-cases/metricas-llamadas.use-case';

@Module({
  imports: [
    forwardRef(() => MetaConnectionsModule),
    WhatsappConnectionsModule,
    forwardRef(() => NotificationsModule),
    PrismaModule,
  ],
  controllers: [WhatsappCallsController],
  providers: [
    {
      provide: WHATSAPP_LLAMADAS_REPOSITORY,
      useClass: PrismaWhatsappLlamadasRepository,
    },
    LlamadaPresenciaService,
    ProcesarLlamadaWebhookUseCase,
    PreAcceptLlamadaUseCase,
    AcceptLlamadaUseCase,
    RejectLlamadaUseCase,
    TerminateLlamadaUseCase,
    IniciarLlamadaSalienteUseCase,
    SolicitarPermisoLlamadaUseCase,
    ObtenerPermisoLlamadaUseCase,
    ListarLlamadasUseCase,
    ObtenerLlamadaUseCase,
    ActualizarLlamadaUseCase,
    ObtenerIceServersUseCase,
    ObtenerSettingsLlamadaUseCase,
    ActualizarSettingsLlamadaUseCase,
    SetPresenciaLlamadasUseCase,
    GetPresenciaLlamadasUseCase,
    ObtenerCapacidadCallingOrgUseCase,
    MetricasLlamadasUseCase,
  ],
  exports: [ProcesarLlamadaWebhookUseCase],
})
export class WhatsappCallsModule {}
