import { Module } from '@nestjs/common';
import { LeadsController } from './presentation/leads.controller';
import { ListarLeadsUseCase } from './application/use-cases/listar-leads.use-case';
import { ObtenerLeadUseCase } from './application/use-cases/obtener-lead.use-case';
import { LEADS_LECTURA_REPOSITORY } from './application/ports/leads-lectura.repository.port';
import { PrismaLeadsLecturaRepository } from './infrastructure/prisma-leads-lectura.repository';

@Module({
  controllers: [LeadsController],
  providers: [
    ListarLeadsUseCase,
    ObtenerLeadUseCase,
    {
      provide: LEADS_LECTURA_REPOSITORY,
      useClass: PrismaLeadsLecturaRepository,
    },
  ],
})
export class LeadsModule {}
