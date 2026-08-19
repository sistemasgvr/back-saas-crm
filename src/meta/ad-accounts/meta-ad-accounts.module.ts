import { Module, forwardRef } from '@nestjs/common';
import { MetaConnectionsModule } from '../connections/meta-connections.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdsetsModule } from '../adsets/adsets.module';
import { AdsModule } from '../ads/ads.module';
import { MetaAdAccountsController } from './presentation/meta-ad-accounts.controller';
import { ListarCuentasVinculadasUseCase } from './application/use-cases/listar-cuentas-vinculadas.use-case';
import { ListarCuentasDisponiblesUseCase } from './application/use-cases/listar-cuentas-disponibles.use-case';
import { ObtenerPerfilCuentaUseCase } from './application/use-cases/obtener-perfil-cuenta.use-case';
import { VincularCuentaUseCase } from './application/use-cases/vincular-cuenta.use-case';
import { DesvincularCuentaUseCase } from './application/use-cases/desvincular-cuenta.use-case';
import { SincronizarCuentaUseCase } from './application/use-cases/sincronizar-cuenta.use-case';
import { ListarCuentasFiltroUseCase } from './application/use-cases/listar-cuentas-filtro.use-case';
import { META_CUENTAS_PUBLICITARIAS_REPOSITORY } from './application/ports/meta-cuentas-publicitarias.repository.port';
import { PrismaMetaCuentasPublicitariasRepository } from './infrastructure/prisma-meta-cuentas-publicitarias.repository';

@Module({
  imports: [
    forwardRef(() => MetaConnectionsModule),
    CampaignsModule,
    AdsetsModule,
    AdsModule,
  ],
  controllers: [MetaAdAccountsController],
  providers: [
    ListarCuentasVinculadasUseCase,
    ListarCuentasDisponiblesUseCase,
    ObtenerPerfilCuentaUseCase,
    VincularCuentaUseCase,
    DesvincularCuentaUseCase,
    SincronizarCuentaUseCase,
    ListarCuentasFiltroUseCase,
    {
      provide: META_CUENTAS_PUBLICITARIAS_REPOSITORY,
      useClass: PrismaMetaCuentasPublicitariasRepository,
    },
  ],
  exports: [META_CUENTAS_PUBLICITARIAS_REPOSITORY],
})
export class MetaAdAccountsModule {}
