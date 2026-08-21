import { Module, forwardRef } from '@nestjs/common';
import { MetaConnectionsModule } from '../../meta/connections/meta-connections.module';
import { WhatsappConnectionsController } from './presentation/whatsapp-connections.controller';
import { ListarNumerosVinculadosUseCase } from './application/use-cases/listar-numeros-vinculados.use-case';
import { ListarNumerosDisponiblesUseCase } from './application/use-cases/listar-numeros-disponibles.use-case';
import { VincularNumeroUseCase } from './application/use-cases/vincular-numero.use-case';
import { DesvincularNumeroUseCase } from './application/use-cases/desvincular-numero.use-case';
import { WHATSAPP_CONEXIONES_REPOSITORY } from './application/ports/whatsapp-conexiones.repository.port';
import { PrismaWhatsappConexionesRepository } from './infrastructure/prisma-whatsapp-conexiones.repository';

@Module({
  imports: [forwardRef(() => MetaConnectionsModule)],
  controllers: [WhatsappConnectionsController],
  providers: [
    ListarNumerosVinculadosUseCase,
    ListarNumerosDisponiblesUseCase,
    VincularNumeroUseCase,
    DesvincularNumeroUseCase,
    {
      provide: WHATSAPP_CONEXIONES_REPOSITORY,
      useClass: PrismaWhatsappConexionesRepository,
    },
  ],
  exports: [WHATSAPP_CONEXIONES_REPOSITORY],
})
export class WhatsappConnectionsModule {}
