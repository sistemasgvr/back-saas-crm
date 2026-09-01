import { Module, forwardRef } from '@nestjs/common';
import { MetaConnectionsModule } from '../meta/connections/meta-connections.module';
import { LeadsController } from './presentation/leads.controller';
import { ListarLeadsUseCase } from './application/use-cases/listar-leads.use-case';
import { ObtenerLeadUseCase } from './application/use-cases/obtener-lead.use-case';
import { TomarLeadUseCase } from './application/use-cases/tomar-lead.use-case';
import { AsignarLeadUseCase } from './application/use-cases/asignar-lead.use-case';
import { LiberarLeadUseCase } from './application/use-cases/liberar-lead.use-case';
import { ActualizarGestionLeadUseCase } from './application/use-cases/actualizar-gestion-lead.use-case';
import { ObtenerHistorialLeadUseCase } from './application/use-cases/obtener-historial-lead.use-case';
import { ObtenerMetaPipelineUseCase } from './application/use-cases/obtener-meta-pipeline.use-case';
import { ListarTableroLeadsUseCase } from './application/use-cases/listar-tablero-leads.use-case';
import { EnviarEventoConversionLeadUseCase } from './application/use-cases/enviar-evento-conversion-lead.use-case';
import { LEADS_LECTURA_REPOSITORY } from './application/ports/leads-lectura.repository.port';
import { PrismaLeadsLecturaRepository } from './infrastructure/prisma-leads-lectura.repository';
import { LEADS_GESTION_REPOSITORY } from './application/ports/leads-gestion.repository.port';
import { PrismaLeadsGestionRepository } from './infrastructure/prisma-leads-gestion.repository';

@Module({
  imports: [forwardRef(() => MetaConnectionsModule)],
  controllers: [LeadsController],
  providers: [
    ListarLeadsUseCase,
    ObtenerLeadUseCase,
    TomarLeadUseCase,
    AsignarLeadUseCase,
    LiberarLeadUseCase,
    ActualizarGestionLeadUseCase,
    ObtenerHistorialLeadUseCase,
    ObtenerMetaPipelineUseCase,
    ListarTableroLeadsUseCase,
    EnviarEventoConversionLeadUseCase,
    {
      provide: LEADS_LECTURA_REPOSITORY,
      useClass: PrismaLeadsLecturaRepository,
    },
    {
      provide: LEADS_GESTION_REPOSITORY,
      useClass: PrismaLeadsGestionRepository,
    },
  ],
  exports: [LEADS_LECTURA_REPOSITORY],
})
export class LeadsModule {}
