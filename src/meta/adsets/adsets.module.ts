import { Module } from '@nestjs/common';
import { AdsetsController } from './presentation/adsets.controller';
import { ListarConjuntosAnunciosUseCase } from './application/use-cases/listar-conjuntos-anuncios.use-case';
import { CONJUNTOS_ANUNCIOS_REPOSITORY } from './application/ports/conjuntos-anuncios.repository.port';
import { PrismaConjuntosAnunciosRepository } from './infrastructure/prisma-conjuntos-anuncios.repository';

@Module({
  controllers: [AdsetsController],
  providers: [
    ListarConjuntosAnunciosUseCase,
    { provide: CONJUNTOS_ANUNCIOS_REPOSITORY, useClass: PrismaConjuntosAnunciosRepository },
  ],
})
export class AdsetsModule {}
