import { Module } from '@nestjs/common';
import { AdsController } from './presentation/ads.controller';
import { ListarAnunciosUseCase } from './application/use-cases/listar-anuncios.use-case';
import { ANUNCIOS_REPOSITORY } from './application/ports/anuncios.repository.port';
import { PrismaAnunciosRepository } from './infrastructure/prisma-anuncios.repository';

@Module({
  controllers: [AdsController],
  providers: [
    ListarAnunciosUseCase,
    { provide: ANUNCIOS_REPOSITORY, useClass: PrismaAnunciosRepository },
  ],
  exports: [ANUNCIOS_REPOSITORY],
})
export class AdsModule {}
