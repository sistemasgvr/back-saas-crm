import { Module } from '@nestjs/common';
import { ListarModulosUseCase } from './application/use-cases/listar-modulos.use-case';
import { CrearModuloUseCase } from './application/use-cases/crear-modulo.use-case';
import { ActualizarModuloUseCase } from './application/use-cases/actualizar-modulo.use-case';
import { CambiarEstadoModuloUseCase } from './application/use-cases/cambiar-estado-modulo.use-case';
import { MODULOS_CATALOGO_REPOSITORY } from './application/ports/modulos-catalogo.repository.port';
import { PrismaModulosCatalogoRepository } from './infrastructure/prisma-modulos-catalogo.repository';

// Sin controller todavía: es el CRUD interno del catálogo que expondrá
// /admin/modules en la Fase 5 (platform-admin), vía PlatformAdminGuard.
@Module({
  providers: [
    ListarModulosUseCase,
    CrearModuloUseCase,
    ActualizarModuloUseCase,
    CambiarEstadoModuloUseCase,
    { provide: MODULOS_CATALOGO_REPOSITORY, useClass: PrismaModulosCatalogoRepository },
  ],
  exports: [ListarModulosUseCase, CrearModuloUseCase, ActualizarModuloUseCase, CambiarEstadoModuloUseCase],
})
export class ModulesModule {}
