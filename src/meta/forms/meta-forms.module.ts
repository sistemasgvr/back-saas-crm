import { Module } from '@nestjs/common';
import { MetaPagesModule } from '../pages/meta-pages.module';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { MetaLeadsModule } from '../leads/meta-leads.module';
import { MetaPageFormsController } from './presentation/meta-page-forms.controller';
import { MetaFormsController } from './presentation/meta-forms.controller';
import { ListarFormulariosPaginaUseCase } from './application/use-cases/listar-formularios-pagina.use-case';
import { ListarFormulariosFiltroUseCase } from './application/use-cases/listar-formularios-filtro.use-case';
import { SincronizarFormulariosPaginaUseCase } from './application/use-cases/sincronizar-formularios-pagina.use-case';
import { META_FORMULARIOS_REPOSITORY } from './application/ports/meta-formularios.repository.port';
import { PrismaMetaFormulariosRepository } from './infrastructure/prisma-meta-formularios.repository';

@Module({
  imports: [MetaPagesModule, MetaConnectionsModule, MetaLeadsModule],
  controllers: [MetaPageFormsController, MetaFormsController],
  providers: [
    ListarFormulariosPaginaUseCase,
    ListarFormulariosFiltroUseCase,
    SincronizarFormulariosPaginaUseCase,
    {
      provide: META_FORMULARIOS_REPOSITORY,
      useClass: PrismaMetaFormulariosRepository,
    },
  ],
  exports: [META_FORMULARIOS_REPOSITORY],
})
export class MetaFormsModule {}
