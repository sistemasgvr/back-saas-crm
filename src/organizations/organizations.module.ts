import { Module } from '@nestjs/common';
import { OrganizationsController } from './presentation/organizations.controller';
import { GetOrganizacionActualUseCase } from './application/use-cases/get-organizacion-actual.use-case';
import { ActualizarOrganizacionActualUseCase } from './application/use-cases/actualizar-organizacion-actual.use-case';
import { ORGANIZACIONES_REPOSITORY } from './application/ports/organizaciones.repository.port';
import { PrismaOrganizacionesRepository } from './infrastructure/prisma-organizaciones.repository';

@Module({
  controllers: [OrganizationsController],
  providers: [
    GetOrganizacionActualUseCase,
    ActualizarOrganizacionActualUseCase,
    { provide: ORGANIZACIONES_REPOSITORY, useClass: PrismaOrganizacionesRepository },
  ],
})
export class OrganizationsModule {}
