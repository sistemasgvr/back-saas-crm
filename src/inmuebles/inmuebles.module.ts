import { Module } from '@nestjs/common';
import { InmueblesController } from './presentation/inmuebles.controller';
import { ListarInmueblesUseCase } from './application/use-cases/listar-inmuebles.use-case';
import { ListarInmueblesFiltroUseCase } from './application/use-cases/listar-inmuebles-filtro.use-case';
import { ObtenerInmuebleUseCase } from './application/use-cases/obtener-inmueble.use-case';
import { CrearInmuebleUseCase } from './application/use-cases/crear-inmueble.use-case';
import { ActualizarInmuebleUseCase } from './application/use-cases/actualizar-inmueble.use-case';
import { EliminarInmuebleUseCase } from './application/use-cases/eliminar-inmueble.use-case';
import { INMUEBLES_REPOSITORY } from './application/ports/inmuebles.repository.port';
import { PrismaInmueblesRepository } from './infrastructure/prisma-inmuebles.repository';

@Module({
  controllers: [InmueblesController],
  providers: [
    ListarInmueblesUseCase,
    ListarInmueblesFiltroUseCase,
    ObtenerInmuebleUseCase,
    CrearInmuebleUseCase,
    ActualizarInmuebleUseCase,
    EliminarInmuebleUseCase,
    {
      provide: INMUEBLES_REPOSITORY,
      useClass: PrismaInmueblesRepository,
    },
  ],
  exports: [INMUEBLES_REPOSITORY],
})
export class InmueblesModule {}
