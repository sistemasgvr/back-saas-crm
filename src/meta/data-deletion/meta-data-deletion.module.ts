import { Module, forwardRef } from '@nestjs/common';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { MetaPagesModule } from '../pages/meta-pages.module';
import { MetaAdAccountsModule } from '../ad-accounts/meta-ad-accounts.module';
import { PrismaModule } from '../../shared/infrastructure/prisma.module';
import { META_ELIMINACION_DATOS_REPOSITORY } from './application/ports/meta-eliminacion-datos.repository.port';
import { PrismaMetaEliminacionDatosRepository } from './infrastructure/prisma-meta-eliminacion-datos.repository';
import { ProcesarCallbackMetaUsuarioUseCase } from './application/use-cases/procesar-callback-meta-usuario.use-case';
import { ObtenerEstadoEliminacionDatosUseCase } from './application/use-cases/obtener-estado-eliminacion-datos.use-case';
import { MetaDataDeletionController } from './presentation/meta-data-deletion.controller';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MetaConnectionsModule),
    forwardRef(() => MetaPagesModule),
    forwardRef(() => MetaAdAccountsModule),
  ],
  controllers: [MetaDataDeletionController],
  providers: [
    ProcesarCallbackMetaUsuarioUseCase,
    ObtenerEstadoEliminacionDatosUseCase,
    {
      provide: META_ELIMINACION_DATOS_REPOSITORY,
      useClass: PrismaMetaEliminacionDatosRepository,
    },
  ],
})
export class MetaDataDeletionModule {}
