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
import { ContarLeadsNuevosUseCase } from './application/use-cases/contar-leads-nuevos.use-case';
import { ListarAgendaVisitasUseCase } from './application/use-cases/listar-agenda-visitas.use-case';
import { ListarVisitasLeadUseCase } from './application/use-cases/listar-visitas-lead.use-case';
import { CrearVisitaAgendaUseCase } from './application/use-cases/crear-visita-agenda.use-case';
import { ActualizarVisitaAgendaUseCase } from './application/use-cases/actualizar-visita-agenda.use-case';
import { CrearActividadAgendaUseCase } from './application/use-cases/crear-actividad-agenda.use-case';
import { ActualizarActividadAgendaUseCase } from './application/use-cases/actualizar-actividad-agenda.use-case';
import { EnviarEventoConversionLeadUseCase } from './application/use-cases/enviar-evento-conversion-lead.use-case';
import { AutoAsignarLeadUseCase } from './application/use-cases/auto-asignar-lead.use-case';
import { ObtenerAutoAsignacionConfigUseCase } from './application/use-cases/obtener-auto-asignacion-config.use-case';
import { ActualizarAutoAsignacionConfigUseCase } from './application/use-cases/actualizar-auto-asignacion-config.use-case';
import { LEADS_LECTURA_REPOSITORY } from './application/ports/leads-lectura.repository.port';
import { PrismaLeadsLecturaRepository } from './infrastructure/prisma-leads-lectura.repository';
import { LEADS_GESTION_REPOSITORY } from './application/ports/leads-gestion.repository.port';
import { PrismaLeadsGestionRepository } from './infrastructure/prisma-leads-gestion.repository';
import { LEAD_VISITAS_REPOSITORY } from './application/ports/lead-visitas.repository.port';
import { PrismaLeadVisitasRepository } from './infrastructure/prisma-lead-visitas.repository';
import { LEAD_ACTIVIDADES_REPOSITORY } from './application/ports/lead-actividades.repository.port';
import { PrismaLeadActividadesRepository } from './infrastructure/prisma-lead-actividades.repository';
import {
  LEAD_AUTO_ASIGNACION_REPOSITORY,
} from './application/ports/lead-auto-asignacion.repository.port';
import { PrismaLeadAutoAsignacionRepository } from './infrastructure/prisma-lead-auto-asignacion.repository';

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
    ContarLeadsNuevosUseCase,
    ListarAgendaVisitasUseCase,
    ListarVisitasLeadUseCase,
    CrearVisitaAgendaUseCase,
    ActualizarVisitaAgendaUseCase,
    CrearActividadAgendaUseCase,
    ActualizarActividadAgendaUseCase,
    EnviarEventoConversionLeadUseCase,
    AutoAsignarLeadUseCase,
    ObtenerAutoAsignacionConfigUseCase,
    ActualizarAutoAsignacionConfigUseCase,
    {
      provide: LEADS_LECTURA_REPOSITORY,
      useClass: PrismaLeadsLecturaRepository,
    },
    {
      provide: LEADS_GESTION_REPOSITORY,
      useClass: PrismaLeadsGestionRepository,
    },
    {
      provide: LEAD_VISITAS_REPOSITORY,
      useClass: PrismaLeadVisitasRepository,
    },
    {
      provide: LEAD_ACTIVIDADES_REPOSITORY,
      useClass: PrismaLeadActividadesRepository,
    },
    {
      provide: LEAD_AUTO_ASIGNACION_REPOSITORY,
      useClass: PrismaLeadAutoAsignacionRepository,
    },
  ],
  exports: [LEADS_LECTURA_REPOSITORY, AutoAsignarLeadUseCase],
})
export class LeadsModule {}
