import { Module } from '@nestjs/common';
import { LeadsController } from './presentation/leads.controller';
import { ListarLeadsUseCase } from './application/use-cases/listar-leads.use-case';
import { ObtenerLeadUseCase } from './application/use-cases/obtener-lead.use-case';
import { TomarLeadUseCase } from './application/use-cases/tomar-lead.use-case';
import { AsignarLeadUseCase } from './application/use-cases/asignar-lead.use-case';
import { LiberarLeadUseCase } from './application/use-cases/liberar-lead.use-case';
import { ActualizarTipoLeadUseCase } from './application/use-cases/actualizar-tipo-lead.use-case';
import { LEADS_LECTURA_REPOSITORY } from './application/ports/leads-lectura.repository.port';
import { PrismaLeadsLecturaRepository } from './infrastructure/prisma-leads-lectura.repository';
import { LEADS_GESTION_REPOSITORY } from './application/ports/leads-gestion.repository.port';
import { PrismaLeadsGestionRepository } from './infrastructure/prisma-leads-gestion.repository';

@Module({
  controllers: [LeadsController],
  providers: [
    ListarLeadsUseCase,
    ObtenerLeadUseCase,
    TomarLeadUseCase,
    AsignarLeadUseCase,
    LiberarLeadUseCase,
    ActualizarTipoLeadUseCase,
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
