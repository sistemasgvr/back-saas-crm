import { Module } from '@nestjs/common';
import { CampaignsController } from './presentation/campaigns.controller';
import { ListarCampanasUseCase } from './application/use-cases/listar-campanas.use-case';
import { CAMPANAS_REPOSITORY } from './application/ports/campanas.repository.port';
import { PrismaCampanasRepository } from './infrastructure/prisma-campanas.repository';

@Module({
  controllers: [CampaignsController],
  providers: [
    ListarCampanasUseCase,
    { provide: CAMPANAS_REPOSITORY, useClass: PrismaCampanasRepository },
  ],
  exports: [CAMPANAS_REPOSITORY],
})
export class CampaignsModule {}
