import { Module, forwardRef } from '@nestjs/common';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { MetaPagesController } from './presentation/meta-pages.controller';
import { ListarPaginasVinculadasUseCase } from './application/use-cases/listar-paginas-vinculadas.use-case';
import { ListarPaginasDisponiblesUseCase } from './application/use-cases/listar-paginas-disponibles.use-case';
import { ObtenerPerfilPaginaUseCase } from './application/use-cases/obtener-perfil-pagina.use-case';
import { VincularPaginaUseCase } from './application/use-cases/vincular-pagina.use-case';
import { DesvincularPaginaUseCase } from './application/use-cases/desvincular-pagina.use-case';
import { ResuscribirWebhookPaginaUseCase } from './application/use-cases/resuscribir-webhook-pagina.use-case';
import { ListarPaginasFiltroUseCase } from './application/use-cases/listar-paginas-filtro.use-case';
import { META_PAGINAS_REPOSITORY } from './application/ports/meta-paginas.repository.port';
import { PrismaMetaPaginasRepository } from './infrastructure/prisma-meta-paginas.repository';

@Module({
  imports: [forwardRef(() => MetaConnectionsModule)],
  controllers: [MetaPagesController],
  providers: [
    ListarPaginasVinculadasUseCase,
    ListarPaginasDisponiblesUseCase,
    ObtenerPerfilPaginaUseCase,
    VincularPaginaUseCase,
    DesvincularPaginaUseCase,
    ResuscribirWebhookPaginaUseCase,
    ListarPaginasFiltroUseCase,
    { provide: META_PAGINAS_REPOSITORY, useClass: PrismaMetaPaginasRepository },
  ],
  exports: [META_PAGINAS_REPOSITORY],
})
export class MetaPagesModule {}
